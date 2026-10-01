const express = require("express");

const router = express.Router();

router.get("/saibamais", (req, res) => {
    res.render("saibamais");
});

module.exports = router;