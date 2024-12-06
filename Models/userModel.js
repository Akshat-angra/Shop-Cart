const mongoose = require('mongoose');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        validate: {
            validator: function (v) {
                return emailRegex.test(v);
            },
            message: props => `${props.value} is not a valid email!`
        }
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters long'],
        validate: {
            validator: function (v) {
                return /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /\W/.test(v);
            },
            message: 'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character.'
        }
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    orders: {
        type: Number,
        default: 0
    },
    lastLogin: {
        type: Date,
        default: null
    },
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    roles: {
        type: [String],
        default: ['user']
    },
    phoneNumber: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

userSchema.methods.incrementLoginCount = async function () {
    try {
        console.log("Login successful for user:", this.email);
        await this.save();
    } catch (err) {
        console.error("Error updating user on login:", err);
    }
};

userSchema.methods.updateLastLogin = async function () {
    try {
        this.lastLogin = new Date();
        this.failedLoginAttempts = 0;
        console.log("Updating last login for user:", this);
        await this.save();
    } catch (err) {
        console.error("Error updating last login:", err);
    }
};

userSchema.methods.incrementFailedLogin = async function () {
    try {
        this.failedLoginAttempts += 1;
        console.log("Incremented failedLoginAttempts to:", this.failedLoginAttempts);
        await this.save();
    } catch (err) {
        console.error("Error incrementing failed login attempts:", err);
    }
};

module.exports = mongoose.model("User", userSchema);
