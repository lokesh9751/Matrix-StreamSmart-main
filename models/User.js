/**
 * models/User.js – Mongoose User Model
 *
 * Manages user accounts, demo roles (tester/admin), and test session ownership.
 */

const mongoose = require('mongoose');
const fallback = require('../utils/inMemoryFallbackStore');

const userSchema = new mongoose.Schema(
  {
    user_id: {
      type: Number,
      unique: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    role: {
      type: String,
      enum: ['tester', 'admin'],
      default: 'tester'
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

userSchema.pre('save', function (next) {
  if (!this.user_id) {
    this.user_id = Math.floor(Date.now() % 1000000);
  }
  next();
});

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

class User {
  static get model() {
    return UserModel;
  }

  static async findAll() {
    if (mongoose.connection.readyState === 1) {
      try {
        const users = await UserModel.find({}, 'user_id username role created_at').lean();
        if (users && users.length > 0) {
          return users;
        }
      } catch (err) {
        console.warn('[User.findAll] MongoDB error, using fallback store:', err.message);
      }
    }
    return fallback.getUsers();
  }

  static async findById(userId) {
    if (mongoose.connection.readyState === 1) {
      try {
        const query = [
          { user_id: Number(userId) }
        ];
        if (mongoose.isValidObjectId(userId)) {
          query.push({ _id: userId });
        }
        const user = await UserModel.findOne({ $or: query }).lean();
        if (user) return user;
      } catch (err) {
        console.warn('[User.findById] MongoDB error, using fallback store:', err.message);
      }
    }
    return fallback.getUserById(userId);
  }

  static async findByUsername(username) {
    if (mongoose.connection.readyState === 1) {
      try {
        const user = await UserModel.findOne({ username }).lean();
        if (user) return user;
      } catch (err) {
        console.warn('[User.findByUsername] MongoDB error, using fallback store:', err.message);
      }
    }
    return fallback.getUserByUsername(username);
  }

  static async create({ username, role = 'tester' }) {
    if (mongoose.connection.readyState === 1) {
      try {
        const user_id = Math.floor(Date.now() % 1000000);
        const user = await UserModel.create({ user_id, username, role });
        return { userId: user.user_id, user_id: user.user_id, username: user.username, role: user.role };
      } catch (err) {
        console.warn('[User.create] MongoDB error, using fallback store:', err.message);
      }
    }
    const u = { user_id: Date.now(), username, role, created_at: new Date().toISOString() };
    return { userId: u.user_id, ...u };
  }
}

User.Schema = userSchema;
User.Model = UserModel;

module.exports = User;
