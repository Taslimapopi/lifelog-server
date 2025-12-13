# 🛠️ LifeLog – Server Side

LifeLog একটি personal growth ও life experience sharing platform। এই রিপোজিটরিটি LifeLog এর **Server Side (Backend)** কোডের জন্য, যেখানে API, Authentication, Database ও Payment logic handle করা হয়।

---

## 🚀 Live API

🔗 Base URL: *(এখানে আপনার server live URL দিন)*

---

## 🧰 Technologies Used

* **Node.js**
* **Express.js**
* **MongoDB**
* **Mongoose**
* **JWT (JSON Web Token)**
* **Firebase Admin SDK** (Auth verification)
* **Stripe** (Payment Integration)
* **dotenv**
* **CORS**

---

## ✨ Core Features

### 🔐 Authentication & Authorization

* Firebase token verification
* JWT based protected routes
* Role-based access (User / Admin)

### 👤 Users

* Save user info to MongoDB
* Get all users (Admin only)
* Update user role (Admin / Premium)
* Block / Unblock users

### 📚 Lessons API

* Create lesson (with author info)
* Get all public lessons
* Get lesson by ID
* Filter by category & access level
* Private & Premium lesson protection

### 💎 Premium System

* Stripe payment intent creation
* Payment success handling
* Update user premium status

### 📊 Admin Utilities

* Platform analytics
* Total users & lessons count
* Monitor premium users

---

## 📂 Project Structure

```bash
lifelog-server/
│── src/
│   ├── config/          # DB & Firebase config
│   ├── middlewares/     # Auth & role middlewares
│   ├── routes/          # API routes
│   ├── controllers/     # Route logic
│   ├── models/          # Mongoose schemas
│   ├── utils/           # Helper functions
│   └── index.js         # App entry point
│── .env
│── package.json
│── README.md
```

---

## 🔐 Environment Variables

Create a `.env` file in the root directory and add:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key
```

⚠️ **Note:** Firebase private key must be formatted correctly with `\n`.

---

## ▶️ Getting Started

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/lifelog-server.git
cd lifelog-server
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Run the Server

```bash
npm run dev
```

Server will run on:

```
http://localhost:5000
```

---

## 🔌 API Endpoints (Sample)

### Auth

* `POST /jwt` → generate JWT

### Users

* `GET /users` → get all users (Admin)
* `PATCH /users/premium/:email` → update premium status

### Lessons

* `POST /lessons` → add lesson
* `GET /lessons` → get public lessons
* `GET /lessons/:id` → get lesson details

### Payments

* `POST /create-payment-intent`

---

## 🧪 Scripts

```bash
npm run dev    # Run with nodemon
npm start      # Production start
```

---

## 🧑‍💻 Author

* **Name:** Taslima Popy
* **Role:** Full Stack Developer (MERN)
* **Country:** Bangladesh 🇧🇩

---

## 📜 License

This project is created for learning & portfolio purposes.

---

## 🤝 Acknowledgements

* Express.js Documentation
* MongoDB
* Firebase Admin SDK
* Stripe API

---

⭐ If you find this backend useful, feel free to give it a star!
