const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcrypt");
const multer = require('multer');
const cookieParser = require('cookie-parser');
const User = require("./Models/userModel.js");
const LastLoginActivity = require('./models/LastLoginActivity');
const Category = require('./models/category');
const PORT = 4000;
const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use(
    session({
        secret: "itsmyseceretdonttellanybody",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60,
        },
    })
);

const uri = "mongodb://localhost:27017/e-commerce";

mongoose
    .connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log("Connected to MongoDB via Mongoose"))
    .catch((err) => console.error("Error connecting to MongoDB: ", err));

async function fetchProducts() {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection("products");
        const count = await collection.countDocuments();
        console.log(`Documents in 'categories' collection: ${count}`);

        if (count === 0) {
            console.log("No categories found in the collection.");
            return [];
        }
        const result = await collection.findOne();
        console.log("Fetched categories:", result);

        if (!result || !result.categories) {
            console.log("No categories data available.");
            return [];
        }
        const productsByCategory = result.categories.map(category => ({
            category_name: category.category_name,
            products: category.products.map(product => ({
                product_id: product.product_id,
                name: product.name,
                price: product.price,
                discounted_price: product.discounted_price,
                image: product.image,
                category_id: product.category_id,
                tags: product.tags,
                stock: product.stock,
                rating: product.rating,
                description: product.description,
            }))
        }));

        console.log("Mapped products:", productsByCategory);
        return productsByCategory;
    } catch (err) {
        console.error("Error fetching products:", err);
        return [];
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/promotions');
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {fileSize: 1000000},
    fileFilter: function (req, file, cb) {
        const fileTypes = /jpeg|jpg|png|gif/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Error: Images Only!');
        }
    }
}).array('images', 5);

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect("/login");
}

function hasRole(role) {
    return (req, res, next) => {
        if (req.session.user && req.session.user.roles.includes(role)) {
            return next();
        }
        res.status(403).render('403', {
            message: "You are not supposed to access this route",
            code: 403,
            timestamp: new Date().toISOString()
        });
    };
}

app.get("/register", (req, res) => {
    res.render("register", {errorMessage: null});
});

app.post('/register', async (req, res) => {
    try {
        const {fullName, email, password, phoneNumber, roles} = req.body;

        if (!fullName || !email || !password || !phoneNumber || !roles) {
            return res.render('register', {errorMessage: 'All fields are required.'});
        }

        const saltRounds = 10;
        const hashPass = await bcrypt.hash(password, saltRounds);

        const newUser = new User({
            fullName,
            email,
            password: hashPass,
            phoneNumber,
            roles: Array.isArray(roles) ? roles : [roles]
        });

        await newUser.save();
        res.redirect('/login');
    } catch (err) {
        let errorMessage = 'Registration failed.';
        if (err.errors && err.errors.password) {
            errorMessage = err.errors.password.message;
        }
        res.render('register', {errorMessage});
    }
});


app.get("/login", (req, res) => {
    res.render("login", {errorMessage: null});
});

app.post("/login", async (req, res) => {
    const {email, password} = req.body;

    try {
        const user = await User.findOne({email});
        if (!user) {
            return res.render("login", {
                errorMessage: "* Invalid email or password.",
            });
        }
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            await user.incrementFailedLogin();
            return res.render("login", {
                errorMessage: "* Invalid email or password.",
            });
        }
        await user.incrementLoginCount();
        await user.updateLastLogin();
        req.session.user = {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            roles: user.roles,
        };
        if (user.roles.includes("admin")) {
            return res.redirect("/admin/dashboard");
        } else {
            return res.redirect("/user/dashboard");
        }
    } catch (error) {
        console.error("Login error:", error);
        return res.render("login", {
            errorMessage: "* Something went wrong. Please try again.",
        });
    }
});


app.get("/api/products", async (req, res) => {
    try {
        const products = await fetchProducts();
        res.json({products});
    } catch (err) {
        console.error("Error in /api/products endpoint:", err);
        res.status(500).json({message: "Server error"});
    }
});


app.get("/shop-cart.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/dashboard/shop-cart", isAuthenticated, (req, res) => {
    res.render("dashboard");
});

app.get("/admin/dashboard", isAuthenticated, hasRole("admin"), async (req, res) => {
    try {
        const activities = [];
        const customers = await User.find({roles: {$ne: "admin"}});
        const userFirstName = req.session.user.fullName.split(" ")[0];
        res.render("admin-dashboard", {
            user: {fullName: userFirstName},
            activities: activities,
            customers: customers
        });

    } catch (err) {
        console.error("Error fetching data:", err);
        res.status(500).send("Server error");
    }
});


app.get("/user/dashboard", isAuthenticated, hasRole("user"), (req, res) => {
    const userFirstName = req.session.user.fullName.split(" ")[0];
    res.render("user-dashboard", {user: {fullName: userFirstName}});
});

app.get("/user/checkout", hasRole("user"), (req, res) => {
    const userFirstName = req.session.user.fullName.split(" ")[0];
    res.render("user-checkout", {user: {fullName: userFirstName}});
});

app.get("/add-products", isAuthenticated, hasRole("admin"), (req, res) => {
    res.render("addproduct");
});

app.delete('/delete-user/:email', isAuthenticated, hasRole("admin"), async (req, res) => {
    try {
        const {email} = req.params;

        const user = await User.findOneAndDelete({email});

        if (!user) {
            return res.status(404).json({success: false, message: "User not found"});
        }

        res.status(200).json({success: true, message: "User deleted successfully"});
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({success: false, message: "Server error"});
    }
});

app.get('/generate-report', (req, res) => {
    res.render('generate-report');
});

app.get("/settings", isAuthenticated, (req, res) => {
    res.render("settings", {
        user: req.session.user,
        successMessage: null,
        errorMessage: null,
    });
});

app.post("/settings", async (req, res) => {
    const {fullName, email, password} = req.body;

    try {
        const userId = req.session.user.id;
        const u = await User.findById(userId);

        if (!u) {
            return res.render("settings", {
                errorMessage: "User not found in our database",
                successMessage: null,
                user: req.session.user,
            });
        }
        u.fullName = fullName;
        u.email = email;

        if (password) {
            u.password = await bcrypt.hash(password, 10);
        }

        await u.save();
        req.session.user.fullName = fullName;
        req.session.user.email = email;
        const redirectUrl =
            req.session.user.role === "admin"
                ? "/admin/dashboard"
                : "/user/dashboard";
        res.render("settings", {
            successMessage: "Information updated successfully!",
            errorMessage: null,
            user: req.session.user,
            redirectUrl: redirectUrl,
        });
    } catch (error) {
        console.error(error);
        res.render("settings", {
            user: req.session.user,
            errorMessage: error.message,
            successMessage: null,
            redirectUrl: null,
        });
    }
});

app.post('/subscribe', (req, res) => {
    const {email} = req.body;

    const userRole = req.session.userRole || 'guest';

    res.render('subscriptionConfirmation', {
        successMessage: "Subscribed successfully!",
        infoMessage: "Our website is currently under construction. Sorry for any inconvenience. We'll come to you soon!",
        userRole: userRole
    });
});

app.get('/some-page', (req, res) => {
    const userRole = req.user.role;
    res.render('some-page', {userRole});
});

app.get('/promotions', (req, res) => {
    const promotions = [
        {name: 'Summer Sale', discount: '20%', validUntil: '2024-08-31'},
        {name: 'Black Friday Sale', discount: '50%', validUntil: '2024-11-30'},
    ];
    res.render('promotion', {promotions});
});


app.get("/customers", isAuthenticated, hasRole("admin"), async (req, res) => {
    try {
        const customers = await User.find({roles: {$ne: "admin"}});
        res.render("customer", {customers});
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.get("/customer/:email", isAuthenticated, async (req, res) => {
    console.log("User email:", req.session.user.email);
    console.log("Requested email:", req.params.email);

    const {email} = req.params;

    try {
        const customer = await User.findOne({email});

        if (!customer) {
            return res.status(404).send("Customer not found");
        }

        res.render("customerProfile", {customer});
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.get("/user/:email/dashboard", isAuthenticated, hasRole("admin"), async (req, res) => {
    const {email} = req.params;

    try {
        const customer = await User.findOne({email});
        if (!customer) {
            return res.status(404).send("Customer not found");
        }
        const userFirstName = customer.fullName.split(" ")[0];
        res.render("user-dashboard", {user: {fullName: userFirstName}});
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

const reports = [
    {id: 1, type: 'User Activity', date: new Date(), status: 'Completed'},
    {id: 2, type: 'Transaction', date: new Date(), status: 'In Progress'},
];

app.get('/view-reports', async (req, res) => {
    try {
        // const reports = await Report.find(); // enable when database has reports
        res.render('view-reports', {reports});
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

const sampleProducts = [
    {
        id: 1,
        name: 'Product 1',
        price: 29.99,
        description: 'Description of Product 1',
        stock: 100,
        quantity: 0
    },
    {
        id: 2,
        name: 'Product 2',
        price: 19.99,
        description: 'Description of Product 2',
        stock: 50,
        quantity: 100
    },
    {
        id: 3,
        name: 'Product 3',
        price: 39.99,
        description: 'Description of Product 3',
        stock: 0,
        quantity: 1000
    },
    {
        id: 4,
        name: 'Product 4',
        price: 49.99,
        description: 'Description of Product 4',
        stock: 20,
        quantity: 10
    }
];

async function getProductsFromDatabase() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(sampleProducts);
        }, 1000);
    });
}

app.get('/inventory', async (req, res) => {
    const products = await getProductsFromDatabase();
    res.render('inventory', {products});
});

app.get('/cart', (req, res) => {
    res.render('cart');
});

app.get('/shop', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
})

app.post('/login', async (req, res) => {
    const {email} = req.body;

    if (!email) return res.status(400).json({error: 'Email is required'});

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to the start of the day

        let activity = await LastLoginActivity.findOne({email});
        if (!activity) {
            activity = new LastLoginActivity({email, lastLoginDates: [today]});
        } else {
            const alreadyLogged = activity.lastLoginDates.some(
                (date) => date.getTime() === today.getTime()
            );
            if (!alreadyLogged) {
                activity.lastLoginDates.push(today);
            }
        }

        await activity.save();
        res.status(200).json({message: 'Login logged successfully'});
    } catch (err) {
        console.error('Error logging login activity:', err);
        res.status(500).json({error: 'Failed to log login activity'});
    }
});

app.get('/user/:email/heatmap', async (req, res) => {
    const {email} = req.params;

    try {
        const activity = await LastLoginActivity.findOne({email});

        if (!activity) {
            return res.status(404).send('No login activity found for this user.');
        }

        const loginData = activity.lastLoginDates;

        // Group login data by year and month
        const monthwiseData = loginData.reduce((acc, date) => {
            const year = date.getFullYear();
            const month = date.getMonth();

            if (!acc[year]) acc[year] = {};
            if (!acc[year][month]) acc[year][month] = 0;

            acc[year][month] += 1; // Increment login count for the month
            return acc;
        }, {});

        res.render('heatmap', {email, monthwiseData});
    } catch (error) {
        console.error('Error retrieving login activity:', error);
        res.status(500).send('Error retrieving login activity');
    }
});

app.get('/user/:email/heatmap', async (req, res) => {
    const {email} = req.params;

    try {
        const activity = await LastLoginActivity.findOne({email});
        const user = await User.findOne({email});

        if (!activity || !user) {
            return res.status(404).send('User or activity not found.');
        }
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        const loginData = activity.lastLoginDates;
        const monthwiseData = loginData.reduce((acc, date) => {
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();

            if (!acc[year]) acc[year] = {};
            if (!acc[year][month]) acc[year][month] = {};
            if (!acc[year][month][day]) acc[year][month][day] = 0;

            acc[year][month][day] += 1;
            return acc;
        }, {});

        console.log('Monthwise Data:', monthwiseData);
        console.log('Year:', currentYear);
        console.log('Month:', currentMonth);
        res.render('heatmap', {
            fullName: user.fullName,
            email,
            monthwiseData,
            year: currentYear,
            month: currentMonth
        });
    } catch (error) {
        console.error('Error retrieving login activity:', error);
        res.status(500).send('Error retrieving login activity');
    }
});


app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
        }
        res.redirect("/login");
    });
});

app.get('/category/:categoryName', async (req, res) => {
    const categoryName = req.params.categoryName;

    try {
        const products = await getCategoryProducts(categoryName);

        if (!products || products.length === 0) {
            return res.status(404).send("No products found for this category.");
        }

        // Render category page with the products
        res.render('categoryPage', {categoryName, products});
    } catch (error) {
        console.error("Error fetching category data:", error);
        res.status(500).send("Error fetching category data");
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});