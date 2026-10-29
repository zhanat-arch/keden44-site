(() => {
  const endpoint='https://api.keden44.com/v1/telegram/owner/session';
  const status=document.getElementById('loginStatus');
  let waiting=0,busy=false;
  // Clear credentials left by the retired public dashboard in this tab.
  sessionStorage.removeItem('keden44-admin-google-token');
  async function signIn(response){
    if(busy||!response.credential)return;
    busy=true;status.textContent='Проверяю доступ...';
    try{
      const result=await fetch(endpoint,{method:'POST',credentials:'include',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({credential:response.credential}),signal:AbortSignal.timeout(15000)});
      const data=await result.json();
      if(!result.ok||!data.ok)throw Error(result.status===429?'Слишком много попыток. Попробуйте позже.':'Этот аккаунт не имеет доступа к панели владельца.');
      const next=new URL(data.next);
      if(next.origin!=='https://api.keden44.com'||!/^\/v1\/telegram\/manage-[a-f0-9]{24}\/$/.test(next.pathname)||next.search||next.hash)throw Error('Некорректный ответ сервера. Обновите страницу.');
      location.replace(next.href);
    }catch(error){status.textContent=error.name==='TimeoutError'?'Сервер не ответил вовремя. Попробуйте ещё раз.':error.message;busy=false;}
  }
  function initialize(){
    if(!window.google?.accounts?.id){
      if(waiting++<60)return setTimeout(initialize,250);
      status.textContent='Не удалось загрузить Google-вход. Обновите страницу.';return;
    }
    window.google.accounts.id.initialize({client_id:'57476430330-a9mvuo5sh4gec820jtd1u5ldcgrm8tpn.apps.googleusercontent.com',callback:signIn});
    window.google.accounts.id.renderButton(document.getElementById('googleButton'),{theme:'outline',size:'large',text:'signin_with',shape:'rectangular'});
  }
  initialize();
})();
