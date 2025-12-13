const express = require("express");
const cors = require("cors");
const app = express();
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;
require("dotenv").config();

const stripe = require("stripe")(process.env.STRIPE_SECRET);

// from conceptual cls
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf-8"
);
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("decoded in the token", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

app.get("/", (req, res) => {
  res.send("lifeLog is running now");
});

// mongo client
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rgrxfrw.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("life_log");
    const lessonCollections = db.collection("lessons");
    const usersCollection = db.collection("users");

    // payment related API

    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.fee) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: paymentInfo.name,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.email,
        mode: "payment",
        metadata: {
          userId: paymentInfo.userId,
        },
        success_url: `${process.env.SITE_DOMAIN}/payment?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
      });
      // console.log(session);
      res.send({ url: session.url });
    });

    app.patch("/payment", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      // console.log(session);
      if (session.payment_status === "paid") {
        const email = session.customer_email;
        const query = { email };

        const update = {
          $set: { isUserPremium: true },
        };
        const result = await usersCollection.updateOne(query, update);

        console.log("User premium updated:", result);
        return res.send({ success: true, message: "User is now premium!" });
      }
      res.send({ success: true });
    });

    // user related API

    app.get("/users/email/:email", async (req, res) => {
      const email = req.params.email;

      const user = await usersCollection.findOne({ email });

      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      res.send(user);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.isUserPremium = false;
      user.createdAt = new Date();
      const email = user.email;
      const userExists = await usersCollection.findOne({ email });

      if (userExists) {
        return res.send({ message: "user exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const updateUser = req.body;

      const query = { _id: new ObjectId(id) };
      const updatedDoc = { $set: updateUser };

      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await usersCollection.deleteOne(query);

      res.send(result);
    });

    // lessons api
    app.get("/public-lessons", async (req, res) => {
      try {
        const {
          limit = 0,
          skip = 0,
          sort = "newest",
          search = "",
          // default
        } = req.query;

        const query = {
          privacy: { $regex: /^public$/i },
          accessLevel: { $regex: /^free$/i },
        };

        if (search) {
          query.title = { $regex: search, $options: "i" };
        }

        if (req.query.category) {
          query.category = { $regex: req.query.category, $options: "i" };
        }

        if (req.query.tone) {
          query.emotionalTone = { $regex: req.query.tone, $options: "i" };
        }

        if (req.query.category && req.query.category !== "all") {
          query.category = { $regex: req.query.category, $options: "i" };
        }

        if (req.query.tone && req.query.tone !== "all") {
          query.emotionalTone = { $regex: req.query.tone, $options: "i" };
        }

        // ---- SORT LOGIC ----
        let sortOption = {};

        if (sort === "newest") {
          sortOption = { createdAt: -1 };
        } else if (sort === "oldest") {
          sortOption = { createdAt: 1 };
        } else if (sort === "mostSaved") {
          sortOption = { savedCount: -1 }; // ধরলাম savedCount আছে
        } else {
          sortOption = { createdAt: -1 }; // fallback
        }

        // ---- FETCH DATA ----
        const result = await lessonCollections
          .find(query)
          .skip(Number(skip))
          .limit(Number(limit))
          .sort(sortOption)
          .toArray();

        const total = await lessonCollections.countDocuments(query);

        res.send({
          result,
          total,
        });
      } catch (error) {
        console.log("Public lessons error:", error);
        res.status(500).send({ error: "Server Error" });
      }
    });

    app.get("/home-lessons", async (req, res) => {
      const result = await lessonCollections.find().limit(10).toArray();
      res.send(result);
    });

    app.get("/lessons", verifyFBToken, async (req, res) => {
      const query = {};
      const { email } = req.query;
      console.log("headers", req.headers);
      if (email) {
        query["author.email"] = email;
      }
      const result = await lessonCollections.find(query).toArray();
      res.send(result);
    });

    app.get("/lessons/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await lessonCollections.findOne(query);
      res.send(result);
    });

    app.post("/lessons", async (req, res) => {
      const lesson = req.body;
      lesson.createdAt = new Date();
      const result = await lessonCollections.insertOne(lesson);
      res.send(result);
    });

    app.put("/update-lessons/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          title: updatedData.title,
          description: updatedData.description,
          image: updatedData.image,
          category: updatedData.category,
          emotionalTone: updatedData.emotionalTone,
          privacy: updatedData.privacy,
          updatedAt: new Date(),
        },
      };

      try {
        const result = await lessonCollections.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Failed to update lesson" });
      }
    });

    app.delete("/lessons/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await lessonCollections.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Lesson not found" });
        }

        res.send({ message: "Lesson deleted successfully", result });
      } catch (error) {
        res.status(500).send({ message: "Error deleting lesson", error });
      }
    });

    // from Chatgpt

    const reportsCollection = db.collection("lessonReports");
    const commentsCollection = db.collection("lessonComments");

    // ================================
    // 2️⃣ Toggle Like
    // ================================
    app.patch("/lessons/:id/toggleLike", async (req, res) => {
      try {
        const id = req.params.id;
        const { userId } = req.body;
        console.log({ id, userId });
        const lesson = await lessonCollections.findOne({
          _id: new ObjectId(id),
        });

        if (!lesson)
          return res.status(404).send({ message: "Lesson not found" });

        const isLiked = lesson.likes?.includes(userId);

        const updateQuery = isLiked
          ? { $pull: { likes: userId } }
          : { $addToSet: { likes: userId } };

        await lessonCollections.updateOne(
          { _id: new ObjectId(id) },
          updateQuery
        );

        res.send({ success: true, liked: !isLiked });
      } catch (error) {
        res.status(500).send({ message: "Error toggling like", error });
      }
    });

    // ================================
    // 3️⃣ Toggle Favorite
    // ================================
    app.patch("/lessons/:id/toggleFavorite", async (req, res) => {
      try {
        const id = req.params.id;
        const { userId } = req.body;

        const lesson = await lessonCollections.findOne({
          _id: new ObjectId(id),
        });

        if (!lesson)
          return res.status(404).send({ message: "Lesson not found" });

        const isFav = lesson.favorites?.includes(userId);

        const updateQuery = isFav
          ? { $pull: { favorites: userId } }
          : { $addToSet: { favorites: userId } };

        await lessonCollections.updateOne(
          { _id: new ObjectId(id) },
          updateQuery
        );

        res.send({ success: true, favorited: !isFav });
      } catch (error) {
        res.status(500).send({ message: "Error toggling favorite", error });
      }
    });

    // ================================
    // 4️⃣ Report Lesson
    // ================================
    // app.post("/reports", async (req, res) => {
    //   try {
    //     const id = req.params.id;

    //     const reportData = {
    //       lessonId: id,
    //       reporterEmail: req.body.email,
    //       reason: req.body.reason,
    //       isFlagged:true,
    //       timestamp: new Date(),

    //     };

    //     await reportsCollection.insertOne(reportData);

    //     res.send({ success: true, message: "Report submitted" });
    //   } catch (error) {
    //     res.status(500).send({ message: "Error submitting report", error });
    //   }
    // });

    app.patch("/lessons/:id/report", async (req, res) => {
      try {
        const lessonId = req.params.id;
        const { reporterEmail, reason } = req.body;

        if (!reporterEmail || !reason) {
          return res.status(400).send({ message: "Missing data" });
        }

        const reportData = {
          reporterEmail,
          reason,
          reportedAt: new Date(),
        };

        const result = await lessonCollections.updateOne(
          { _id: new ObjectId(lessonId) },
          {
            $set: { isFlagged: true },
            $push: { reports: reportData },
          }
        );

        res.send({
          success: true,
          message: "Lesson reported successfully",
          result,
        });
      } catch (error) {
        res.status(500).send({ message: "Report failed", error });
      }
    });

    // api for report page frontend

    app.get("/admin/reported-lessons", async (req, res) => {
      const result = await lessonCollections
        .find({ isFlagged: true })
        .toArray();

      res.send(result);
    });

    // api for ignoredreport

    app.patch("/lessons/:id/ignore-reports", async (req, res) => {
  const { id } = req.params;

  const result = await lessonCollections.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { isFlagged: false },
      $unset: { reports: "" },
    }
  );

  res.send(result);
});


    // ================================
    // 5️⃣ Get Recommended Lessons (6 max)
    // ================================
    app.get("lessons/recommended/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const currentLesson = await lessonsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!currentLesson)
          return res.status(404).send({ message: "Lesson not found" });

        const recommended = await lessonsCollection
          .find({
            category: currentLesson.category,
            _id: { $ne: new ObjectId(id) },
          })
          .limit(6)
          .toArray();

        res.send(recommended);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Error fetching recommended lessons", error });
      }
    });

    // ================================
    // 6️⃣ Add Comment
    // ================================
    app.post("lessons/:id/comment", async (req, res) => {
      try {
        const id = req.params.id;

        const commentData = {
          lessonId: id,
          userId: req.body.userId,
          userName: req.body.userName,
          comment: req.body.comment,
          createdAt: new Date(),
        };

        await commentsCollection.insertOne(commentData);

        res.send({ success: true, message: "Comment added" });
      } catch (error) {
        res.status(500).send({ message: "Error adding comment", error });
      }
    });

    // favorite lessons of a user

    app.get("/lessons/favorites/:userId", async (req, res) => {
      try {
        const userId = req.params.userId;
        const { category, emotionalTone } = req.query;

        // Base query: find all lessons where favorites array contains userId
        let query = {
          favorites: userId,
        };

        // Add optional filters
        if (category) {
          query.category = category;
        }

        if (emotionalTone) {
          query.emotionalTone = emotionalTone;
        }

        const lessons = await lessonCollections
          .find(query)
          .sort({ _id: -1 })
          .toArray();

        res.send(lessons);
      } catch (error) {
        console.error("Favorites fetch error:", error);
        res.status(500).send({ message: "Internal Server Error", error });
      }
    });

    // api for removing favroute

    app.patch("/lessons/remove-favorite", async (req, res) => {
      try {
        const { lessonId, userId } = req.body;

        const result = await lessonCollections.updateOne(
          { _id: new ObjectId(lessonId) },
          { $pull: { favorites: userId } } // <-- removes userId from favorites array
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: "Favorite not found to remove" });
        }

        res.send({ success: true, message: "Removed from favorites" });
      } catch (error) {
        res.status(500).send({ message: "Error removing favorite", error });
      }
    });

    // api for showing fav lesson in profile
    app.get("/lessons/favorites/count/:userId", async (req, res) => {
      const userId = req.params.userId;

      const count = await lessonCollections.countDocuments({
        favorites: userId,
      });

      res.send({ count });
    });

    // api for showing user public lessons in profile

    app.get("/lessons/user/:userId", async (req, res) => {
      const userId = req.params.userId;

      const lessons = await lessonCollections
        .find({ authorId: userId, privacy: "public" }) // only public
        .sort({ _id: -1 }) // newest first
        .toArray();

      res.send(lessons);
    });

    // ================================
    // 7️⃣ Get All Comments of Lesson
    // ================================
    app.get("lessons/:id/comments", async (req, res) => {
      try {
        const id = req.params.id;

        const comments = await commentsCollection
          .find({ lessonId: id })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(comments);
      } catch (error) {
        res.status(500).send({ message: "Error fetching comments", error });
      }
    });

    // ADMIN API

    // allUsers APi

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // manage lessons api es

    app.get("/lessons/stats/all", async (req, res) => {
      const total = await lessonCollections.countDocuments();
      const publicLessons = await lessonCollections.countDocuments({
        accessLevel: "free",
      });
      const premiumLessons = await lessonCollections.countDocuments({
        accessLevel: "premium",
      });
      const flagged = await lessonCollections.countDocuments({
        isFlagged: true,
      });

      res.send({ total, publicLessons, premiumLessons, flagged });
    });

    // marked reviewed

    app.patch("/lessons/review/:id", async (req, res) => {
      const id = req.params.id;

      const result = await lessonCollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isReviewed: true } }
      );

      res.send(result);
    });

    // featured

    app.patch("/lessons/feature/:id", async (req, res) => {
      const id = req.params.id;

      const result = await lessonCollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isFeatured: true } }
      );

      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`LifeLog listening at port ${port}`);
});
