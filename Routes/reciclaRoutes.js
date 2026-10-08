const express = require("express");
const router = express.Router();

router.get("/recicla", (req, res) => {
    res.render("recicla");
});

module.exports = router;