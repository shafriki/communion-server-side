require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb'); 

const app = express();
const port = process.env.PORT || 5000;

// Middleware
const corsOptions = {
    origin: ['http://localhost:5173'],
    credentials: true,
    optionSuccessStatus: 200,
};
  
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2a8vu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let usersCollection, eventsCollection;

async function run() {
  try {
    await client.connect();
    usersCollection = client.db('CommunionHub').collection('users');
    eventsCollection = client.db('CommunionHub').collection('events');

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // Save user in DB
    app.post('/users/:email', async (req, res) => {
        const email = req.params.email;
        const query = { email };
        const user = req.body;

        const isExist = await usersCollection.findOne(query);
        if (isExist) {
            return res.send(isExist);
        }

        const result = await usersCollection.insertOne({
            ...user,
            timestamp: new Date(),
        });
        res.send(result);
    });

    // Get users from DB
    app.get('/users', async (req, res) => {
        try {
            const users = await usersCollection.find().toArray();
            res.send(users);
        } catch (error) {
            console.error("Error fetching users:", error);
            res.status(500).send({ message: "Failed to retrieve users" });
        }
    });

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}
run().catch(console.dir);

// JWT Verification Middleware
const verifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbidden access' });
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'forbidden access' });
        }
        req.decoded = decoded;
        next();
    });
};

// Add an event with JWT verification
app.post('/events', verifyToken, async (req, res) => {
    const eventData = req.body;
    eventData.createdAt = new Date(); 
    const result = await eventsCollection.insertOne(eventData); 
    res.send(result); 
});

// get all events
app.get('/events', async (req, res) => {
    try {
        const events = await eventsCollection.find().toArray();
        res.send(events);
    } catch (error) {
        res.status(500).send({ message: "Error fetching events", error });
    }
});

// get single event
app.get('/events/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    try {
        const event = await eventsCollection.findOne(query);
        if (event) {
            res.send(event);
        } else {
            res.status(404).send({ message: "Event not found" });
        }
    } catch (error) {
        res.status(500).send({ message: "Error fetching event", error });
    }
});



// Generate JWT token
app.post('/jwt', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).send({ message: 'Email is required.' });
    }

    const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '7d',
    });

    res.send({ success: true, token });
});

app.get('/', (req, res) => {
    res.send('Communion server running');
});

app.listen(port, () => {
    console.log(`Communion server running on port: ${port}`);
});
