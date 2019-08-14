// ==UserScript==
// @name         フレックスチェッカー
// @namespace    net.ghippos.userjs.kingtime
// @version      1.2
// @description  夕方5時のチャイムで帰りたい
// @author       mohemohe
// @match        https://s3.kingtime.jp/admin/*
// @grant        none
// ==/UserScript==

(() => {
    const config = {
        みなし残業: 35,
    };

    const totalTime = parseInt(document.querySelector('body > div > div.htBlock-mainContents > div > div.htBlock-normalTable.specific-table > table > tbody > tr:nth-child(1) > td:nth-child(2)').innerHTML);
    const totalDays = Array.from(document.querySelectorAll('.htBlock-scrollTable_day')).filter(element => element.classList.length == 1 || element.classList.contains('specific-uncomplete')).length;
    const workDays = parseInt(document.querySelector('body > div > div.htBlock-mainContents > div > div.htBlock-autoNewLineTable.specific-autoNewLineTable > ul > li:nth-child(1) > div').innerHTML, 10);
    const paidHolidays = parseInt(document.querySelector('body > div > div.htBlock-mainContents > div > div.htBlock-autoNewLineTable.specific-autoNewLineTable > ul > li:nth-child(5) > div').innerHTML.split(' ')[0], 10);
    const pastDays = workDays + paidHolidays;
    const remainDays = totalDays - pastDays;
    const pastTime = parseFloat(document.querySelector('body > div > div.htBlock-mainContents > div > div.htBlock-normalTable.specific-table > table > tbody > tr:nth-child(1) > td.all_work_time').innerHTML);
    const minimumTime = (totalTime - pastTime) / remainDays;
    const todayStartDate = new Date();

    // NOTE: 出勤の打刻をしている場合はその出勤を使う　そうじゃなければ前日の出勤時間を使って予測する
    const todayStartTimeString = Array.from(document.querySelectorAll('.work_day_type.specific-uncomplete + .start_end_timerecord.specific-uncomplete p')).pop() || Array.from(document.querySelectorAll('.work_day_type + .start_end_timerecord p')).filter(p => p.innerText.indexOf(':') !== -1).pop();

    if (todayStartTimeString) {
        const todayStartTime = todayStartTimeString.innerText.trim().split(" ")[1];
        todayStartDate.setHours(...`${todayStartTime}:00`.split(':'));
    }
    todayStartDate.setSeconds(todayStartDate.getSeconds() + minimumTime * 60 * 60 + 3600);

    if (document.querySelectorAll('.F').length === 0) {
        document.querySelector('.face_template').innerHTML += `
<div class="F">
    <h4 class="htBlock-box_subTitle">情報</h4>
    <p>今月の平日: ${totalDays}</p>
    <p>経過日数(今日を含まない): ${pastDays}</p>
    <p>残日数(今日を含む): ${remainDays}</p>
    <p>合計勤務時間: ${pastTime}</p>
    <p>平均勤務時間: ${pastTime / pastDays}</p>
    <p>残勤務時間: ${totalTime - pastTime}</p>
    <p>残日数あたりの最低勤務時間: ${minimumTime}</p>
    <p>残日数あたりの最大勤務時間: ${((totalTime + config.みなし残業) - pastTime) / remainDays}</p>
    <p>帰宅してもいい時刻: ${todayStartDate.toLocaleTimeString()}</p>
</div>
`;
    }
})();
