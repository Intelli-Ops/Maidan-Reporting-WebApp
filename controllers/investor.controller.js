const investorService = require('../services/investor.service');

async function getInvestors(req, res, next) {
  try {
    const investors = await investorService.getAllInvestors();
    res.json({
      success: true,
      data: investors,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInvestors,
};
