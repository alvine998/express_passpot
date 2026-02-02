const { News, User } = require("../models");
const { Op } = require("sequelize");
const { success, error } = require("../utils/responseHelper");

// Create News
exports.createNews = async (req, res) => {
  const { title, content, imageUrl, category, published } = req.body;

  try {
    const news = await News.create({
      title,
      content,
      imageUrl,
      category,
      published: published !== undefined ? published : true,
      authorId: req.user.id,
    });

    return success(res, "News created successfully", news, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Get all News (Public)
exports.getAllNews = async (req, res) => {
  const { category, search } = req.query;

  try {
    let where = { published: true };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.title = { [Op.like]: `%${search}%` };
    }

    const newsList = await News.findAll({
      where,
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "displayName", "avatar"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return success(res, "News retrieved successfully", newsList);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Get News Detail (Public)
exports.getNewsById = async (req, res) => {
  const { id } = req.params;

  try {
    const news = await News.findByPk(id, {
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "displayName", "avatar"],
        },
      ],
    });

    if (!news) {
      return error(res, "News not found", 404);
    }

    return success(res, "News retrieved successfully", news);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Update News
exports.updateNews = async (req, res) => {
  const { id } = req.params;
  const { title, content, imageUrl, category, published } = req.body;

  try {
    const news = await News.findByPk(id);

    if (!news) {
      return error(res, "News not found", 404);
    }

    // Check if user is author (or admin if implemented)
    if (news.authorId !== req.user.id) {
      return error(res, "Unauthorized to update this news", 403);
    }

    if (title) news.title = title;
    if (content) news.content = content;
    if (imageUrl) news.imageUrl = imageUrl;
    if (category) news.category = category;
    if (published !== undefined) news.published = published;

    await news.save();
    return success(res, "News updated successfully", news);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

// Delete News
exports.deleteNews = async (req, res) => {
  const { id } = req.params;

  try {
    const news = await News.findByPk(id);

    if (!news) {
      return error(res, "News not found", 404);
    }

    // Check if user is author
    if (news.authorId !== req.user.id) {
      return error(res, "Unauthorized to delete this news", 403);
    }

    await news.destroy();
    return success(res, "News deleted successfully");
  } catch (err) {
    return error(res, err.message, 500);
  }
};
