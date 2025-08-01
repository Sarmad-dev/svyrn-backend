import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },
    price: {
      amount: {
        type: Number,
        required: [true, "Price is required"],
        min: [0, "Price must be positive"],
      },
      currency: {
        type: String,
        default: "USD",
        enum: ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"],
      },
    },
    category: {
      type: String,
      required: true,
      enum: [
        "electronics",
        "clothing",
        "home",
        "books",
        "sports",
        "automotive",
        "toys",
        "beauty",
        "jewelry",
        "art",
        "music",
        "tools",
        "garden",
        "pets",
        "food",
        "other",
      ],
      default: "other",
    },
    privacy: {
      type: String,
      enum: ["public", "friends"],
      default: "public",
    },
    condition: {
      type: String,
      enum: ["new", "like_new", "good", "fair", "poor"],
      default: "new",
      required: true,
    },
    contact: {
      email: String,
      phone: String,
    },
    images: [String],
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    location: {
      address: String,
      city: String,
      state: String,
      country: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    availability: {
      status: {
        type: String,
        enum: ["available", "pending", "sold", "removed"],
        default: "available",
      },
      quantity: {
        type: Number,
        default: 1,
        min: 0,
      },
    },
    specifications: [
      {
        name: String,
        value: String,
      },
    ],
    tags: [String],
    views: {
      type: Number,
      default: 0,
    },
    interested: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        interestedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reviews: [
      {
        reviewer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        comment: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    shippingOptions: {
      pickup: {
        type: Boolean,
        default: true,
      },
      delivery: {
        type: Boolean,
        default: false,
      },
      shipping: {
        type: Boolean,
        default: false,
      },
      shippingCost: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSold: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
productSchema.index({ category: 1, availability: 1 });
productSchema.index({ seller: 1, createdAt: -1 });
productSchema.index({ title: "text", description: "text", tags: "text" });
productSchema.index({ "price.amount": 1 });
productSchema.index({ condition: 1 });

// Virtual for average rating
productSchema.virtual("averageRating").get(function () {
  if (this.reviews.length === 0) return 0;
  const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
  return sum / this.reviews.length;
});

const Product = mongoose.model("Product", productSchema);

Product.syncIndexes();
export default Product;
