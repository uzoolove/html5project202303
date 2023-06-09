var path = require('path');
var fs = require('fs');
var moment = require('moment');
var MyError = require('../errors');

// DB 접속
var db;
const { MongoClient } = require('mongodb');
const url = 'mongodb://127.0.0.1:27017';
const client = new MongoClient(url);

async function main() {
  await client.connect();
  db = client.db('mulpang');
  db.member = db.collection('member');
  db.shop = db.collection('shop');
  db.coupon = db.collection('coupon');
  db.purchase = db.collection('purchase');
  db.epilogue = db.collection('epilogue');
  db.sequence = db.collection('sequence');
  return 'DB 접속 완료.';
}

main()
  .then(console.info)
  .catch(console.error);

// 쿠폰 목록조회
module.exports.couponList = async function(qs={}){
	// 검색 조건
  var now = moment().format('YYYY-MM-DD');
	var query = {};
	// 1. 판매 시작일이 지난 쿠폰, 구매 가능 쿠폰(기본 검색조건)	
  query['saleDate.start'] = {$lte: now};
  query['saleDate.finish'] = {$gte: now};
	// 2. 전체/구매가능/지난쿠폰
  switch(qs.date){
    case 'all':
      delete query['saleDate.finish'];
      break;
    case 'past':
      query['saleDate.finish'] = {$lt: now};
      break;
  }
	// 3. 지역명	
  var location = qs.location;
  if(location){
    query['region'] = location;
  }
	// 4. 검색어	
  var keyword = qs.keyword;
  if(keyword && keyword.trim() != ''){
    var regexp = new RegExp(keyword, 'i');
    query['$or'] = [{couponName: regexp}, {desc: regexp}];
  }

	// 정렬 옵션
	var orderBy = {};
	// 1. 사용자 지정 정렬 옵션
  var orderCondition = qs.order;
  if(orderCondition){
    orderBy[orderCondition] = -1; // -1: 내림차순, 1: 오름차순
  }
	// 2. 판매 시작일 내림차순(최근 쿠폰)	
  orderBy['saleDate.start'] = -1;
	// 3. 판매 종료일 오름차순(종료 임박 쿠폰)
  orderBy['saleDate.finish'] = 1;

	// 출력할 속성 목록
	var fields = {
		couponName: 1,
		image: 1,
		desc: 1,
		primeCost: 1,
		price: 1,
		useDate: 1,
		quantity: 1,
		buyQuantity: 1,
		saleDate: 1,
		position: 1
	};
	
	// TODO 쿠폰 목록을 조회한다.
	var count = 0;
  var offset = 0;
  if(qs.page){
    count = 5;
    offset = (qs.page-1) * count;
  }
  var result = await db.coupon.find(query).project(fields).sort(orderBy).skip(offset).limit(count).toArray();
  var totalCount = await db.coupon.countDocuments(query);
  result.totalPage = Math.floor((totalCount+count-1)/count);
  console.log(result.length, '건 조회됨.');
  return result;
};

// 쿠폰 상세 조회
module.exports.couponDetail = async function(io, _id){
	// coupon, shop, epilogue 조인
	var coupon = await db.coupon.aggregate([{
    $match: { _id }
  }, {
    // shop 조인
    $lookup: {
      from: 'shop', // 대상 컬렉션
      localField: 'shopId', // coupon.shopId
      foreignField: '_id', // shop._id
      as: 'shop'  // coupon.shop 속성으로 조인 결과 추가
    }
  }, {
    // shop 조인 결과를(배열) 객체로 변환
    $unwind: '$shop'
  }, {
    // epilogue 조인
    $lookup: {
      from: 'epilogue', // 대상 컬렉션
      localField: '_id', // coupon._id
      foreignField: 'couponId', // epilogue.couponId
      as: 'epilogueList'  // coupon.epilogueList 속성으로 조인 결과 추가
    }
  }]).next();
  console.log(coupon.couponName);

  // 뷰 카운트를 하나 증가시킨다.
	await db.coupon.updateOne({_id}, {$inc: {viewCount: 1}});
	// 웹소켓으로 수정된 조회수 top5를 전송한다.
  var top5 = await topCoupon('viewCount');
	io.emit('top5', top5);

  return coupon;
};

// 구매 화면에 보여줄 쿠폰 정보 조회
module.exports.buyCouponForm = async function(_id){
	var fields = {
		couponName: 1,
    price: 1,
    quantity: 1,
    buyQuantity: 1,
    'image.detail': 1
	};
	// TODO 쿠폰 정보를 조회한다.
	return await db.coupon.findOne({_id}, {projection: fields});
};

// 쿠폰 구매
module.exports.buyCoupon = async function(params){
	// 구매 컬렉션에 저장할 형태의 데이터를 만든다.
	var document = {
		couponId: Number(params.couponId),
		email: params.userid,	// 나중에 로그인한 id로 대체
		quantity: Number(params.quantity),
		paymentInfo: {
			cardType: params.cardType,
			cardNumber: params.cardNumber,
			cardExpireDate: params.cardExpireYear + params.cardExpireMonth,
			csv: params.csv,
			price: Number(params.unitPrice) * Number(params.quantity)
		},
		regDate: moment().format('YYYY-MM-DD hh:mm:ss')
	};

	// TODO 구매 정보를 등록한다.
  try{
    var sequence = await db.sequence.findOneAndUpdate({_id: 'purchase'}, {$inc: {seq: 1}});
    document._id = sequence.value.seq;
    var result = await db.purchase.insertOne(document);

    // TODO 쿠폰 구매 건수를 하나 증가시킨다.
    await db.coupon.updateOne({_id: document.couponId}
                            , {$inc: {buyQuantity: document.quantity}});
    return result.insertedId;
  }catch(err){
    console.error(err);
    // throw new Error('쿠폰 구매에 실패했습니다. 잠시 후 다시 시도하시기 바랍니다.');
    throw MyError.FAIL;
  }
};	
	
// 추천 쿠폰 조회
var topCoupon = module.exports.topCoupon = async function(condition){
  // 검색 조건
  var now = moment().format('YYYY-MM-DD');
  var query = {};
  // 1. 판매 시작일이 지난 쿠폰, 구매 가능 쿠폰(기본 검색조건)	
  query['saleDate.start'] = {$lte: now};
  query['saleDate.finish'] = {$gte: now};
	var order = {
    [condition]: -1
  };
  var list = await db.coupon.aggregate([
    { $match: query },
    { $sort: order }, 
    { $limit: 5 }, 
    {
      $project: {
        couponName: 1,
        value: '$'+condition
      }
    }]).toArray();
  return list;
};

// 지정한 쿠폰 아이디 배열을 받아서 남은 수량을 넘겨준다.
module.exports.couponQuantity = async function(coupons){
  var list = await db.coupon.find(
    {_id: {$in: coupons}}, 
    {projection: {quantity: 1, buyQuantity: 1, couponName: 1}}).toArray();
  return list;
};

// 임시로 저장한 프로필 이미지를 회원 이미지로 변경한다.
function saveImage(tmpFileName, profileImage){
	var tmpDir = path.join(__dirname, '..', 'public', 'tmp');
  var profileDir = path.join(__dirname, '..', 'public', 'image', 'member');
  var org = path.join(tmpDir, tmpFileName);
  var dest = path.join(profileDir, profileImage);
	// TODO 임시 이미지를 member 폴더로 이동시킨다.
	fs.rename(org, dest, function(err){
    if(err) console.error(err);
  });
}

// 회원 가입
module.exports.registMember = async function(params){
	var member = {
    _id: params._id,
    password: params.password,
    profileImage: params._id,
    regDate: moment().format('YYYY-MM-DD hh:mm:ss')
  };
  try{
    var result = await db.member.insertOne(member);
    saveImage(params.tmpFileName, member.profileImage);
    return result.insertedId;
  }catch(err){
    console.error(err);
    if(err.code == 11000){
      // throw new Error('이미 등록된 이메일입니다.');
      throw MyError.USER_DUPLICATE;
    }else{
      // throw new Error('작업 처리에 실패했습니다. 잠시 후 다시 시도하시기 바랍니다.');
      throw MyError.FAIL;
    }
  }
};

// 로그인 처리
module.exports.login = async function(params){
	// TODO 지정한 아이디와 비밀번호로 회원 정보를 조회한다.
	try{
    // 아이디와 비밀번호 동시 체크
    // var result = await db.member.findOne(params, {projection: {profileImage: 1}});

    // 아이디와 비밀번호 따로 체크
    // '해당 아이디가 존재하지 않습니다.'
    // '비밀번호를 확인하시기 바랍니다.'
    var result = await db.member.findOne({_id: params._id});
  }catch(err){
    console.error(err);
    // throw new Error('작업 처리에 실패했습니다. 잠시 후 다시 시도하시기 바랍니다.');
    throw MyError.FAIL;
  }

  // if(!result){
  //   throw new Error('아이디와 비밀번호를 확인하시기 바랍니다.');
  // }

  if(result){
    if(params.password != result.password){
      // throw new Error('비밀번호를 확인하시기 바랍니다.');
      throw MyError.CHECK_PASSWORD;
    }
  }else{
    // throw new Error('해당 아이디가 존재하지 않습니다.');
    throw MyError.CHECK_ID;
  }
  return {_id: result._id, profileImage: result.profileImage};
};

// 회원 정보 조회
module.exports.getMember = async function(userid){
	var result = await db.purchase.aggregate([
    { $match: {email: userid} }, 
    { $lookup: {
      from: 'coupon',
      localField: 'couponId',
      foreignField: '_id',
      as: 'coupon'
    }}, 
    { $unwind: '$coupon' }, 
    { $lookup: {
      from: 'epilogue',
      localField: 'epilogueId',
      foreignField: '_id',
      as: 'epilogue'
    }}, 
    { $unwind: {
      path: '$epilogue',
      preserveNullAndEmptyArrays: true
    } }, 
    { $project: {
      _id: 1,
      couponId: 1,
      regDate: 1,
      'coupon.couponName': 1,
      'coupon.image.main': 1,
      epilogue: 1
    }}, 
    { $sort: {regDate: -1} }
  ]).toArray();
  console.log(result);
  return result;
};

// 회원 정보 수정
module.exports.updateMember = async function(userid, params){
	var oldPassword = params.oldPassword;
  try{
    var member = await db.member.findOne({_id: userid, password: oldPassword});
  }catch(err){
    console.error(err);
    // throw new Error('작업 처리에 실패했습니다. 잠시 후 다시 시도하시기 바랍니다.');
    throw MyError.FAIL;
  }
  if(member){
    if(params.tmpFileName){
      saveImage(params.tmpFileName, member.profileImage);
    }
    if(params.password.trim() != ''){
      await db.member.updateOne({_id: userid}, {$set: {password: params.password}});
    }
  }else{
    // throw new Error('이전 비밀번호가 맞지 않습니다.');
    throw MyError.PASSWORD_INCRRECT;
  }
};

// 쿠폰 후기 등록
module.exports.insertEpilogue = async function(userid, epilogue){
  try{
    var sequence = await db.sequence.findOneAndUpdate({_id: 'epilogue'}, {$inc: {seq: 1}});
    epilogue._id = sequence.value.seq;
    epilogue.writer = userid;
    epilogue.regDate = moment().format('YYYY-MM-DD hh:mm:ss');

    var epilogueResult = await db.epilogue.insertOne(epilogue);
    await db.purchase.updateOne({_id: epilogue.purchaseId}, {$set: {epilogueId: epilogue._id}});
    var coupon = await db.coupon.findOne({_id: epilogue.couponId});
    var update = {
      $inc: {epilogueCount: 1},
      $set: {satisfactionAvg: (coupon.satisfactionAvg * coupon.epilogueCount + epilogue.satisfaction) / (coupon.epilogueCount+1)}
    };
    await db.coupon.updateOne({_id: epilogue.couponId}, update);
    return epilogueResult.insertedId;
  }catch(err){
    console.error(err);
    // throw new Error('작업 처리에 실패했습니다. 잠시 후 다시 시도하시기 바랍니다.');
    throw MyError.FAIL;
  }
	

};