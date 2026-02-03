const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Call = sequelize.define(
  "Call",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    callType: {
      type: DataTypes.ENUM("audio", "video"),
      defaultValue: "audio",
    },
    status: {
      type: DataTypes.ENUM("missed", "answered", "rejected", "outgoing"),
      defaultValue: "outgoing",
    },
    duration: {
      type: DataTypes.INTEGER, // in seconds
      defaultValue: 0,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = Call;
