var express = require('express');
var router = express.Router();
const model = require('../model/mulpangDao');
const MyUtil = require('../utils/myutil');
const { body, validationResult } = require('express-validator');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.redirect('today');
});

// 오늘 메뉴
router.get('/today', async function(req, res, next) {
  var list = await model.couponList();
  res.render('today', { list });
});

// 쿠폰 상세 조회
router.get('/coupons/:_id', async function(req, res, next) {
  var coupon = await model.couponDetail(Number(req.params._id));
  res.render('detail', { coupon, toStar: MyUtil.toStar });
});

// 쿠폰 구매 화면
router.get('/purchase/:_id', async function(req, res, next) {
  var coupon = await model.buyCouponForm(Number(req.params._id));
  res.render('buy', { coupon });
});

// 쿠폰 구매
const validatePurchase = [
  body('quantity').isInt({ min: 1 }).withMessage('수량을 1개 이상 정수로 입력하세요.'),
  body('cardNumber').isLength({ min: 16, max: 16 }).withMessage('16자리의 카드번호를 입력하세요.'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(errors.array());
      return res.json({ errors: errors.array()[0] });
    }
    next();
  }
];
router.post('/purchase', validatePurchase, async function(req, res, next) {
  try{
    var purchaseId = await model.buyCoupon(req.body);
    res.end(String(purchaseId));
  }catch(err){
    res.json({errors: {msg: err.message}});
  }
});


router.get('/:page.html', function(req, res, next) {
  res.render(req.params.page);
});


module.exports = router;
