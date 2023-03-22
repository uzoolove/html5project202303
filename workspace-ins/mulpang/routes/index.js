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
// 쿠폰 구매
router.post('/purchase', validatePurchase, async function(req, res, next) {
  try{
    var purchaseId = await model.buyCoupon(req.body);
    res.end(String(purchaseId));
  }catch(err){
    res.json({errors: {msg: err.message}});
  }
});

// 근처 메뉴
router.get('/location', async function(req, res, next){
  var list = await model.couponList();
  res.render('location', {list});
});
// 추천 메뉴
router.get('/best', function(req, res, next){
  res.render('best');
});
// top5 쿠폰 조회
router.get('/topCoupon', async function(req, res, next){
  var list = await model.topCoupon(req.query.condition);
  res.json(list);
});
// 모두 메뉴
router.get('/all', async function(req, res, next){
  res.render('all');
});
// 쿠폰 남은 수량 조회
router.get('/couponQuantity', async function(req, res, next){
  res.end('success');
});


module.exports = router;
