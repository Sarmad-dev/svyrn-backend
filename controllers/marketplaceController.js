import Product from "../models/Product.js";
import cloudinary from "../utils/cloudinary.js";
import NotificationHelper from "../utils/notificationHelper.js";

// @desc    Create a new product listing
// @route   POST /api/marketplace/products
// @access  Private
export const createProduct = async (req, res) => {
  try {
    const { images } = req.body;

    // Upload images in parallel and wait for all to complete
    const uploadedImages = await Promise.all(
      images.map((image) =>
        cloudinary.uploader.upload(image, { resource_type: "image" })
      )
    );

    // Extract secure URLs
    const imagesUrl = uploadedImages.map((result) => result.secure_url);

    // Create product with uploaded image URLs
    const product = await Product.create({
      ...req.body,
      images: imagesUrl,
      seller: req.user._id,
    });

    await product.populate("seller", "name username profilePicture");

    console.log("PRODUCT: ", product);
    res.status(201).json({
      status: "success",
      message: "Product listed successfully",
      data: { product },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error creating product listing",
      error: error.message,
    });
  }
};

// @desc    Search/browse products
// @route   GET /api/marketplace/products
// @access  Private
export const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      condition,
      minPrice,
      maxPrice,
      location,
      sortBy = "createdAt",
      sortOrder = "desc",
      limit = 20,
      page = 1,
    } = req.query;

    const skip = (page - 1) * limit;
    let query = {};

    // Search functionality
    if (search) {
      query.$text = { $search: search };
    }

    // Filters
    if (category) {
      query.category = category;
    }

    if (condition) {
      query.condition = condition;
    }

    if (minPrice || maxPrice) {
      query["price.amount"] = {};
      if (minPrice) query["price.amount"].$gte = Number(minPrice);
      if (maxPrice) query["price.amount"].$lte = Number(maxPrice);
    }

    if (location) {
      query.$or = [
        { "location.city": { $regex: location, $options: "i" } },
        { "location.state": { $regex: location, $options: "i" } },
        { "location.country": { $regex: location, $options: "i" } },
      ];
    }

    // Sorting
    let sort = {};
    if (search) {
      sort.score = { $meta: "textScore" };
    } else {
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;
    }

    const products = await Product.find(query)
      .populate("seller", "name username profilePicture")
      .select(
        "title price images category condition location views createdAt reviews"
      ) // include reviews to compute rating
      .sort(sort)
      .limit(Number(limit))
      .skip(skip)
      .lean(); // convert Mongoose docs to plain JS objects

    // Add averageRating manually using virtual
    const productsWithRating = products.map((product) => {
      const sum =
        product.reviews?.reduce((acc, review) => acc + review.rating, 0) || 0;
      const avg = product.reviews?.length ? sum / product.reviews.length : 0;
      return {
        ...product,
        averageRating: parseFloat(avg.toFixed(1)),
      };
    });

    const total = await Product.countDocuments(query);

    res.status(200).json({
      status: "success",
      data: {
        products: productsWithRating,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching products",
      error: error.message,
    });
  }
};

// @desc    Get product details
// @route   GET /api/marketplace/products/:id
// @access  Private
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("seller", "name username profilePicture isVerified")
      .populate("reviews.reviewer", "name username profilePicture");

    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    // Increment view count
    product.views += 1;
    await product.save();

    const isOwner = product.seller._id.toString() === req.user.id.toString();

    res.status(200).json({
      status: "success",
      data: {
        product,
        isOwner,
        averageRating: product.averageRating,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching product",
      error: error.message,
    });
  }
};

// @desc    Get user products
// @route   GET /api/marketplace/products/user/:id
// @access  Private
export const getUserProducts = async (req, res) => {
  try {
    let query;

    if (req.query.search) {
      query = {
        seller: req.user._id,
        title: { $regex: req.query.search, $options: "i" },
      };
    } else {
      query = { seller: req.user._id };
    }

    const products = await Product.find(query)
      .populate("seller", "name username profilePicture isVerified")
      .populate("reviews.reviewer", "name username profilePicture");

    res.status(200).json({
      status: "success",
      data: { products },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching user products",
      error: error.message,
    });
  }
};

// @desc    Update product listing
// @route   PUT /api/marketplace/products/:id
// @access  Private
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product || !product.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    if (product.seller.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You can only update your own listings",
      });
    }

    Object.assign(product, req.body);
    await product.save();

    await product.populate("seller", "name username profilePicture");

    res.status(200).json({
      status: "success",
      message: "Product updated successfully",
      data: { product },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error updating product",
      error: error.message,
    });
  }
};

// @desc    Add review to product
// @route   PUT /api/marketplace/products/:id/review
// @access  Private
export const addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product || !product.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    if (product.seller.toString() === req.user.id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You can not add reviews to your own listings",
      });
    }

    const review = {
      reviewer: req.user.id,
      rating,
      comment,
      createdAt: new Date(),
    };

    product.reviews.push(review);
    await product.save();

    await product.populate("seller", "name username profilePicture");

    res.status(200).json({
      status: "success",
      message: "Review added successfully",
      data: { product },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error adding review",
      error: error.message,
    });
  }
};

// @desc    Express interest in a product
// @route   POST /api/marketplace/products/:id/interest
// @access  Private
export const expressInterest = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product || !product.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    if (product.seller.toString() === req.user.id.toString()) {
      return res.status(400).json({
        status: "error",
        message: "You cannot show interest in your own product",
      });
    }

    const existingInterest = product.interested.find(
      (interest) => interest.user.toString() === req.user.id.toString()
    );

    if (existingInterest) {
      return res.status(400).json({
        status: "error",
        message: "You have already shown interest in this product",
      });
    }

    product.interested.push({
      user: req.user.id,
      interestedAt: new Date(),
    });

    await product.save();

    await NotificationHelper.createNotification({
      recipient: product.seller,
      sender: req.user.id,
      type: 'system',
      title: 'Product Interest',
      message: `showed interest in your product "${product.title}"`,
      data: { productId: product._id },
      priority: 'medium'
    });


    res.status(200).json({
      status: "success",
      message: "Interest recorded successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error recording interest",
      error: error.message,
    });
  }
};

// @desc    Get product categories with counts
// @route   GET /api/marketplace/categories
// @access  Private
export const getCategories = async (req, res) => {
  try {
    const categories = await Product.aggregate([
      {
        $match: {
          "availability.status": "available",
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.status(200).json({
      status: "success",
      data: { categories },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching categories",
      error: error.message,
    });
  }
};

// @desc    Delete product listing
// @route   DELETE /api/marketplace/products/:id
// @access  Private
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    if (product.seller.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: "error",
        message: "You can only delete your own listings",
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: "success",
      message: "Product listing deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error deleting product",
      error: error.message,
    });
  }
};
