const paymentMethodService = require('../services/paymentMethod.service');

async function getPaymentMethods(req, res, next) {
  try {
    const paymentMethods = await paymentMethodService.getAllPaymentMethods();
    res.json({
      success: true,
      data: paymentMethods,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPaymentMethods,
};
