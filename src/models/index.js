const User = require("./User");
const Conversation = require("./Conversation");
const Message = require("./Message");
const Status = require("./Status");
const Call = require("./Call");
const News = require("./News");
const Friend = require("./Friend");
const { sequelize } = require("../config/database");

// User and Conversation Many-to-Many
User.belongsToMany(Conversation, { through: "UserConversations" });
Conversation.belongsToMany(User, { through: "UserConversations" });

// User and Status (Story)
User.hasMany(Status, { foreignKey: "userId", as: "statuses" });
Status.belongsTo(User, { foreignKey: "userId", as: "user" });

// User and Call (History)
User.hasMany(Call, { foreignKey: "callerId", as: "placedCalls" });
User.hasMany(Call, { foreignKey: "receiverId", as: "receivedCalls" });
Call.belongsTo(User, { foreignKey: "callerId", as: "caller" });
Call.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });

// User and News (Author)
User.hasMany(News, { foreignKey: "authorId", as: "news" });
News.belongsTo(User, { foreignKey: "authorId", as: "author" });

// Message Associations
Conversation.hasMany(Message, { foreignKey: "conversationId", as: "messages" });
Message.belongsTo(Conversation, { foreignKey: "conversationId" });

User.hasMany(Message, { foreignKey: "senderId", as: "sentMessages" });
Message.belongsTo(User, { foreignKey: "senderId", as: "sender" });

// Last Message in Conversation
Message.hasOne(Conversation, {
  foreignKey: "lastMessageId",
  as: "lastMessageConversation",
});
Conversation.belongsTo(Message, {
  foreignKey: "lastMessageId",
  as: "lastMessage",
});

// User Friends (Self-referential Many-to-Many)
User.belongsToMany(User, {
  through: Friend,
  as: "friends",
  foreignKey: "userId",
  otherKey: "friendId",
});

User.belongsToMany(User, {
  through: Friend,
  as: "addedBy",
  foreignKey: "friendId",
  otherKey: "userId",
});

module.exports = {
  User,
  Conversation,
  Message,
  Status,
  Call,
  News,
  Friend,
  sequelize,
};
