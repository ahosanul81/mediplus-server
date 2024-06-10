const express = require('express')
const app = express()
const cors = require('cors')
var jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middle ware
app.use(cors());
app.use(express.json())

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jhmpwvf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});








async function run() {
    try {

        const slideCollection = client.db("mediplusDB").collection("slide");
        const categoryCollection = client.db("mediplusDB").collection("category");
        const shopCollection = client.db("mediplusDB").collection("shop");
        const cartCollection = client.db("mediplusDB").collection("cart");
        const usersCollection = client.db("mediplusDB").collection("users");
        const paymentsCollection = client.db("mediplusDB").collection("payments");
        // Connect the client to the server	(optional starting in v4.7)

        // auth middleWare
        const verifyToken = (req, res, next) => {
            // console.log('inside the verifyToken', req.headers.authorization);

            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
                // if issuer mismatch, err == invalid issuer
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded
                next()
            });

        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            // console.log(user);
            const isAdmin = user?.role === 'admin'
            // console.log(isAdmin);
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }
        const verifySeller = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            // console.log(user);
            const isSeller = user?.role === 'seller'
            // console.log(isAdmin);
            if (!isSeller) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

        // auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
            res.send({ token })
        })




        // user related api

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })
        app.post('/users', async (req, res) => {
            const { userInfo } = req.body;
            const result = await usersCollection.insertOne(userInfo)
            res.send(result)
        })
        app.patch('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const { updatedRole } = req.body;
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedUserInfo = {
                $set: {
                    role: updatedRole
                }
            }
            const result = await usersCollection.updateOne(filter, updatedUserInfo, options)
            res.send(result)
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            let admin = false;
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            admin = true;
            res.send({ admin })
        })
        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const role = user?.role;
            res.send({ role })
        })

        // slide api
        app.get('/slide', async (req, res) => {
            const result = await slideCollection.find().toArray();
            res.send(result)
        })

        app.post('/slide',verifyToken, verifyAdmin, async (req, res) => {
            const { slideInfo } = req.body;
            const result = await slideCollection.insertOne(slideInfo)
            res.send(result)
        })

        // shop data api

        app.post('/shop', async (req, res) => {
            const { medicineInfo } = req.body;
            const result = await shopCollection.insertOne(medicineInfo)
            res.send(result)
        })

        // category api

        app.get('/category', async (req, res) => {
            const result = await categoryCollection.find().toArray();
            res.send(result)
        })
        app.get('/shop', async (req, res) => {
            const result = await shopCollection.find().toArray();
            res.send(result)
        })
        app.get('/shop/category/:name', async (req, res) => {
            const categoryName = req.params.name;
            const query = { category: categoryName }
            const result = await shopCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/shop/:email', async (req, res) => {
            const email = req.params.email;
            const query = { sellerEmail: email }
            const result = await shopCollection.find(query).toArray();
            res.send(result)

        })

        app.post('/category', async (req, res) => {
            const { categoryInfo } = req.body;
            const result = await categoryCollection.insertOne(categoryInfo)
            res.send(result)
        })

        app.delete('/category/:id', async (req, res) => {
            const id = req.params.id;
            const result = await categoryCollection.deleteOne({ _id: new ObjectId(id) })
            // console.log(selectedCategory);
            res.send(result)
        })

        // cart api
        app.get('/cart/:email', async (req, res) => {
            const email = req.params.email;
            // console.log(email);
            const query = { userEmail: email }
            const result = await cartCollection.find(query).toArray();
            res.send(result)
        })

        app.delete('/cart/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result)
        })

        app.post('/cart/:id', verifyToken, async (req, res) => {
            const { userEmail } = req.body;
            console.log(userEmail);
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const cartItem = await shopCollection.findOne(query)
            if (!cartItem) {
                return
            }
            const { _id: productId, sellerEmail, ...newCartItem } = cartItem
            newCartItem.productId = id;
            newCartItem.userEmail = userEmail;
            newCartItem.sellerEmail = sellerEmail;
            console.log(newCartItem);
            const result = await cartCollection.insertOne(newCartItem);
            res.send(result)
        })


        // payment 
        app.post('/create-payment-intent', async (req, res) => {
            const { totalPrice } = req.body;
            const amount = parseInt(totalPrice) * 100
            // console.log(amount);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.get('/payments', verifyToken, verifyAdmin, async (req, res) => {
            const result = await paymentsCollection.find().toArray();
            res.send(result)
        })
        app.get('/payments/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const result = await paymentsCollection.find({ userEmail: email }).toArray();
            res.send(result)
        })


        app.get('/paymentsHistory', verifyToken, async (req, res) => {
            // console.log(req.decoded);
            const productDetailsFromPayment = await paymentsCollection.aggregate([

                {
                    $unwind: '$cartIds'
                },
                {
                    $addFields: {
                        convertedId: { $toObjectId: '$cartIds' }
                    }
                },
                {
                    $lookup: {
                        from: 'shop', // replace with your shop collection name
                        localField: 'convertedId',
                        foreignField: '_id',
                        as: 'productDetails'
                    }
                },
                {
                    $unwind: '$productDetails'
                },
                {
                    $group: {
                        _id: null,
                        productDetails: { $push: '$productDetails' }
                    }
                },

                {
                    $match: { $expr: { sellerEmail: req.decoded.email } }
                }
            ]).toArray()

            const sellerPostedMedicineIds = productDetailsFromPayment.filter(item=> item._id)
            console.log(sellerPostedMedicineIds);

            console.log(productDetailsFromPayment);

            res.send(productDetailsFromPayment)
        })

        app.post('/payment', async (req, res) => {
            const { paymentInfo } = req.body;
            const result = await paymentsCollection.insertOne(paymentInfo);

            const query = { _id: { $in: paymentInfo.cartIds.map(id => new ObjectId(id)) } }
            // console.log(query);
            const deleteCart = await cartCollection.deleteMany(query)

            res.send({ result, deleteCart })
        })

        app.patch('/payments/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    status: 'paid'
                }
            }
            const result = await paymentsCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })

        // admin stat
        app.get('/adminStat',verifyToken, verifyAdmin, async (req, res) => {
            const payments = await paymentsCollection.find().toArray()
            const totalRevenue = payments.reduce((acc, curr) => acc + curr.paidPrice, 0)
            const paidTotalPaymentData = await paymentsCollection.find({ status: 'paid' }).toArray()
            const paidTotal = paidTotalPaymentData.reduce((acc, curr) => acc + curr.paidPrice, 0)
            const pendingPaymentData = await paymentsCollection.find({ status: 'pending' }).toArray()
            const pendingTotal = pendingPaymentData.reduce((acc, curr) => acc + curr.paidPrice, 0)
            res.send({ totalRevenue, paidTotal, pendingTotal })
        })








        // await client.connect();
        // // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    console.log('bistro boss server is running');
    res.send('Mediplus server is running')
})
app.listen(port, () => {
    console.log(`Mediplus is running on port: ${port}`);
})
