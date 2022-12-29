const AWS = require('aws-sdk');
const express = require('express');
const serverless = require('serverless-http');
const uuid = require('uuid')

const app = express();

const TODOS_TABLE = process.env.TODOS_TABLE;
const dynamoDbClient = new AWS.DynamoDB.DocumentClient();

app.use(express.json());

app.get('/todos', async function(req, res) {
  let result = await dynamoDbClient.scan({
    TableName: TODOS_TABLE
  }).promise();

  let { Items } = result;

  while (result.LastEvaluatedKey) {
    result = await dynamoDbClient.scan({
      TableName: TODOS_TABLE,
      ExclusiveStartKey: result.LastEvaluatedKey
    }).promise();

    Items = Items.concat(result.Items)
  }

  res.status(200).json(Items);
});

app.get('/todos/:id', async function (req, res) {
  const params = {
    TableName: TODOS_TABLE,
    Key: {
      id: req.params.id,
    },
  };

  try {
    const { Item } = await dynamoDbClient.get(params).promise();
    if (Item) {
      res.json(Item);
    } else {
      res
        .status(404)
        .json({ error: 'not found' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Could not retreive user' });
  }
});

app.post('/todos', async function (req, res) {
  const {todo, checked} = req.body;
  if (typeof todo !== 'string') {
    res.status(400).json({ error: '"todo" value must be a string' });
    return;
  }

  if (checked !== undefined && typeof checked !== 'boolean') {
    res.status(400).json({error: '"checked" value must be a boolean'});
    return;
  }

  const timestamp = Date.now();

  const item = {
    id: uuid.v4(),
    checked: checked || false,
    todo: todo,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const params = {
    TableName: TODOS_TABLE,
    Item: item,
  };

  try {
    await dynamoDbClient.put(params).promise();
    res.json(item);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Could not create user' });
  }
});

app.put('/todos/:id', async function(req, res) {
  const { Item } = await dynamoDbClient.get({ 
    TableName: TODOS_TABLE, 
    Key: { id: req.params.id }
  }).promise();

  if (Item) {
    const {checked, todo} = req.body;
    
    if (typeof checked === 'boolean') Item.checked = checked;
    if (typeof todo === 'string') Item.todo = todo;
    Item.updatedAt = Date.now();

    try {
      await dynamoDbClient.put({TableName: TODOS_TABLE, Item: Item}).promise();
      res.status(200).json(Item);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: 'Could not update todo' });
    }
  } else {
    res.status(400).json({ error: 'not found' });
  }
});

app.delete('/todos/:id', async function(req, res) {
  try {
    const result = dynamoDbClient.delete({Key: {id: req.params.id}});
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json('Could not delete todo');
  }
});

app.use((req, res, next) => {
  return res.status(404).json({
    error: 'Not Found',
  });
});


module.exports.handler = serverless(app);
