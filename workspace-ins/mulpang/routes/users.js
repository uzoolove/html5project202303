var express = require('express');
var router = express.Router();
const model = require('../model/mulpangDao');
const MyUtil = require('../utils/myutil');
const checklogin = require('../middleware/checklogin');

// 회원 가입 화면
router.get('/new', function(req, res, next) {
  res.render('join');
}); 
// 프로필 이미지 업로드
var path = require('path');
var tmp = path.join(__dirname, '..', 'public', 'tmp');
var multer = require('multer');
var storage = multer.diskStorage({
  destination: function(req, file, cb){
    cb(null, tmp);
  },
  filename: function(req, file, cb){
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

router.post('/profileUpload', multer({storage}).single('profile'), function(req, res, next) {
  res.end(req.file.filename);   // 임시 파일명 응답
});
// 회원 가입 요청
router.post('/new', async function(req, res, next) {
  try{
    var result = await model.registMember(req.body);
    res.end(result);
  }catch(err){
    // res.json({errors: {message: err.message}});
    next(err);
  }
});
// 간편 로그인
router.post('/simpleLogin', async function(req, res, next) {
  try{
    var user = await model.login(req.body);
    req.session.user = user;
    res.json(user);
  }catch(err){
    // res.json({errors: {message: err.message}});
    next(err);
  }
});
// 로그아웃
router.get('/logout', function(req, res, next) {
  req.session.destroy();
  res.redirect('/');
});
// 로그인 화면
router.get('/login', function(req, res, next) {
  res.render('login');
});
// 로그인
router.post('/login', async function(req, res, next) {
  try{
    var user = await model.login(req.body);
    req.session.user = user;
    res.redirect(req.session.backurl || '/');
  }catch(err){
    res.render('login', {errors: err});
  }
});
// 마이 페이지
router.get('/', checklogin, async function(req, res, next) {
  var userid = req.session.user._id;
  var member = await model.getMember(userid);
  res.render('mypage', {purchases: member, toStar: MyUtil.toStar});
});
// 회원 정보 수정
router.put('/', checklogin, async function(req, res, next) {
  var userid = req.session.user._id;
  try{
    await model.updateMember(userid, req.body);
    res.end('success');
  }catch(err){
    // res.json({errors: {message: err.message}});
    next(err);
  }
});
// 구매 후기 등록
router.post('/epilogue', checklogin, async function(req, res, next) {
  var userid = req.session.user._id;
  try{
    var epilogue = {
      couponId: Number(req.body.couponId),
      purchaseId: Number(req.body.purchaseId),
      satisfaction: Number(req.body.satisfaction),
      content: req.body.content
    };
    var epilogueId = await model.insertEpilogue(userid, epilogue);
    res.end(String(epilogueId));
  }catch(err){
    // res.json({errors: {message: err.message}});
    next(err);
  }
});


module.exports = router;
