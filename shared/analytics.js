(() => {
 if(window.__k44AnalyticsInitialized||!['keden44.com','www.keden44.com'].includes(location.hostname))return;
 const titles={'/blog/attachment-update/':'Обновление прикрепления KEDEN44','/':'KEDEN44','/guide.html':'Инструкция KEDEN44','/privacy.html':'Конфиденциальность','/terms.html':'Условия использования','/extension/':'Расширение KEDEN44','/help/':'Справка KEDEN44','/subscription/':'Подписка KEDEN44','/support/':'Поддержать проект','/monitor/':'Монитор KEDEN44','/tools/':'Инструменты KEDEN44','/tools/accounting/':'Отчёты бухгалтеру','/tools/audit/':'Сверка требования','/blog/':'Блог KEDEN44','/blog/astana-keden/':'От АСТАНА-1 к KEDEN','/blog/zagruzka-proshla/':'Загрузка прошла успешно','/blog/reports-and-audit/':'Сверка требований и отчёты бухгалтеру'};
 const path=location.pathname.replace(/\/index\.html$/,'/')||'/';
 if(!titles[path])return;
 window.__k44AnalyticsInitialized=true;
 const pageLocation='https://keden44.com'+path;
 let referrer='';try{const url=new URL(document.referrer);referrer=url.origin;}catch{}
 window.dataLayer=window.dataLayer||[];
 window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
 window.gtag('js',new Date());
 window.gtag('config','G-TKXSRRX2X8',{send_page_view:false,page_location:pageLocation,page_title:titles[path],page_referrer:referrer,allow_google_signals:false,allow_ad_personalization_signals:false});
 window.gtag('event','page_view',{page_location:pageLocation,page_title:titles[path],page_referrer:referrer});
 const tag=document.createElement('script');tag.async=true;tag.src='https://www.googletagmanager.com/gtag/js?id=G-TKXSRRX2X8';tag.dataset.k44GoogleTag='';document.head.append(tag);
})();
