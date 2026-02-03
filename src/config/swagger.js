const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Passpot API",
      version: "1.0.0",
      description:
        "Secure Chat Application API with multi-stage authentication, WebRTC signaling, and more.",
      contact: {
        name: "Developer",
      },
    },
    servers: [
      {
        url: "/api",
        description: "Current Server",
      },
      {
        url: "http://localhost:5040/api",
        description: "Local Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [path.join(__dirname, "../routes/*.js")], // Absolute path for Docker compatibility
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
