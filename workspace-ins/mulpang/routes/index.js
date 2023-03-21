var express = require('express');
var router = express.Router();
const model = require('../model/mulpangDao');
const MyUtil = require('../utils/myutil');

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

router.get('/:page.html', function(req, res, next) {
  res.render(req.params.page);
});


module.exports = router;
