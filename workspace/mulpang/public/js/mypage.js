$(function(){	
	// 프로필 이미지 선택 시(common.js의 common.upload.profileImage 함수를 호출한다.)
	$('#profile').change(common.upload.profileImage);	
	
	// 회원 수정 버튼 클릭 이벤트
	$('.form_section > form').submit(updateMember);

	// 후기 등록 이벤트
	$('.coupon_preview > form').submit(registEpilogue);
});

 
// 회원 정보를 수정한다.
async function updateMember(event){
  event.preventDefault(); // 브라우저의 기본 동작(submit) 취소
  if($('#password').val() != $('#password2').val()){
    alert('비밀번호와 비밀번호 확인이 맞지 않습니다.');
  }else{
    // 회원 수정을 요청한다.
    var result = await $.ajax('/users', {
      type: 'put',
      data: $(this).serialize()
    });
    if(result.errors){
      alert(result.errors.message);
    }else{
      alert('회원 정보 수정이 완료되었습니다.');
      window.location.reload();
    }
  }
}

// 상품후기 입력
async function registEpilogue(event){
  event.preventDefault(); // 브라우저의 기본 동작(submit) 취소
  var result = await $.post('/users/epilogue', $(this).serialize());
  if(result.errors){
    alert(result.errors.message);
  }else{
    alert('쿠폰 사용 후기가 등록되었습니다.');
    window.location.reload();
  }
}
