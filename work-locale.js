(() => {
  if (!window.TopaWork.active) return;

  const labels = {
    'ПРОВЕРИТЬ':'ТЕКШЕРҮҮ',
    'ПЕРЕЙТИ К ЗАДАНИЮ':'ТАПШЫРМАГА ӨТҮҮ',
    'ДАЛЕЕ':'УЛАНТУУ',
    'ДАЛЕЕ →':'УЛАНТУУ →',
    'ЗАВЕРШИТЬ':'АЯКТОО',
    'ПОПРОБОВАТЬ ЕЩЁ':'КАЙРА АРАКЕТ КЫЛУУ',
    'Верно! Отличная работа':'Туура! Азаматсыз!',
    'Почти! Правильный ответ показан зелёным.':'Бул жолу туура эмес. Туура жооп жашыл менен белгиленди.',
    'Сначала выберите слово слева.':'Адегенде сол жактагы сөздү тандаңыз.',
    'Пара найдена!':'Туура жуп!',
    'Все пары собраны верно!':'Бардык жуптар туура!',
    'Эти слова не образуют пару. Попробуйте ещё.':'Бул сөздөр бири-бирине дал келбейт. Кайра аракет кылыңыз.',
    'Ответьте по-русски…':'Орусча жооп бериңиз…',
    'Прогресс сохранён.':'Окуудагы жетишкендигиңиз сакталды.',
    'Урок повторён — знания закреплены!':'Сабакты ийгиликтүү кайталадыңыз!',
    'ВЕРНУТЬСЯ К ДОРОГЕ':'САБАКТАРГА КАЙТУУ',
    'Этот урок пока недоступен':'Бул сабак азырынча жеткиликсиз',
    'Сначала завершите предыдущий урок':'Адегенде мурунку сабакты аяктаңыз',
    'Дневная цель обновлена':'Күндүк максат жаңыртылды',
    'Регистрация появится в следующей версии':'Катталуу кийинки версияда жеткиликтүү болот',
    'Урок уже пройден':'Сабак аякталган',
    'Воспроизвести реплику':'Репликаны угуу',
    'Приостановить реплику':'Аудиону тындыруу',
    'Не удалось воспроизвести аудио. Попробуйте ещё раз.':'Аудиону ойнотуу мүмкүн болгон жок. Кайра аракет кылыңыз.',
    'Показать текст реплики':'Репликанын текстин көрсөтүү',
    'Диалог':'Маек'
  };

  const text = {
    '.brand__sub':'Орус тилин үйрөнүңүз',
    '.nav__settings span':'Жөндөөлөр',
    '.nav__item[data-section="Обучение"] span':'Сабактар',
    '.nav__item[data-section="Курсы"] span':'Курстар',
    '.nav__item[data-section="Статистика"] span':'Статистика',
    '.nav__item[data-section="Режимы"] span':'Режимдер',
    '.nav__item[data-section="Профиль"] span':'Профиль',
    '#guideBtn span':'СӨЗДҮК',
    '#reviewBtn strong':'Кайталоо',
    '#continueBtn':'УЛАНТУУ →',
    '#modesTitle':'Окуу режимдери',
    '.modes-head p':'ТОПА менен кантип окууну тандаңыз',
    '#personalMode strong':'Өз алдынча окуу',
    '#workMode strong':'Компаниялар үчүн',
    '#educationMode strong':'Билим берүү мекемелери үчүн',
    '.mode-copy small':'Өтүү үчүн басыңыз',
    '#educationTitle':'Бул режим азырынча иштелип жатат',
    '#educationNotice button':'ТҮШҮНҮКТҮҮ',
    '#statisticsTitle':'Статистика',
    '#statisticsView header p':'Тил үйрөнүүдөгү жетишкендиктериңиз',
    '#profileView header p':'ТОПАдагы аккаунтуңуз',
    '#accountCard h2':'Аккаунтуңуз',
    '.account__avatar':'М',
    '.account__copy strong':'Конок',
    '.account__copy span':'Окуудагы жетишкендиктериңизди сактаңыз',
    '#accountBtn':'АККАУНТ ТҮЗҮҮ',
    '#progressCard h2':'Окуудагы жетишкендиктер',
    '#progressCard .card__title span':'1-бөлүм',
    '#progressCard .progress-copy span':'аяктады',
    '#wordCard small':'Күндүн сөзү',
    '#goalCard h2':'Бүгүнкү максат',
    '#goalEdit':'Өзгөртүү',
    '#streakStart':'Баштоого убакыт келди!',
    '#guideTitle':'Сөздүк',
    '#guideReviewBtn':'КАЙТАЛООГО ӨТҮҮ',
    '#repeatCancel':'ЖОККО ЧЫГАРУУ',
    '#repeatStart':'САБАКТЫ КАЙТАЛОО'
  };

  const attributes = {
    '.sidebar':{'aria-label':'Негизги меню'},
    '.nav__settings':{'aria-label':'Жөндөөлөр',title:'Жөндөөлөр'},
    '.trail':{'aria-label':'Сабактардын картасы'},
    '#wordCard':{'aria-label':'Күндүн сөзү'},
    '#wordDay':{lang:'ru'},
    '.goal__icon img':{alt:''},
    '.streak-card__mascot':{alt:''},
    '.lesson-progress':{'aria-label':'Сабактын жүрүшү'},
    '#closeModal':{'aria-label':'Сабакты жабуу'},
    '#closeGuide':{'aria-label':'Сөздүктү жабуу'}
  };

  for (const [selector, value] of Object.entries(text)) {
    document.querySelectorAll(selector).forEach(node => { node.textContent = value; });
  }
  for (const [selector, values] of Object.entries(attributes)) {
    const node = document.querySelector(selector);
    for (const [name, value] of Object.entries(values)) node.setAttribute(name, value);
  }
  document.documentElement.lang = 'ky';
  document.title = 'Курулушта орус тили · ТОПА';
  window.TopaWorkLocale = {
    translate: value => labels[value] ?? value,
    language: 'Орус тили',
    lesson: number => number + '-сабак'
  };
})();
