// ==UserScript==
// @name         フレックスチェッカー
// @namespace    net.ghippos.userjs.kingtime
// @version      1.6
// @description  夕方5時のチャイムで帰りたい
// @author       mohemohe
// @match        https://s3.kingtime.jp/admin/*
// @grant        none
// ==/UserScript==

const config = {
    みなし残業: 35,
    スケジュール: {
        有休: '有休',
        半休: [
            'AM有休',
            'PM有休',
        ],
    },
};

class Day {
    constructor(tr) {
        this.tr = tr;
    }

    get _schedule() {
        const schedule = this.tr.querySelector('.schedule');
        if (!schedule) {
            return "";
        }
        return schedule.innerText.trim();
    }

    get isHoliday() {
        const day = this.tr.querySelector('.htBlock-scrollTable_day');
        if (!day) {
            return false;
        }
        const {color} = window.getComputedStyle(day);
        const rgb = new RGB(color);
        return rgb.r > 128 || rgb.g > 128 || rgb.b > 128;
    }

    get isPaidHoliday() {
        return this._schedule === config.スケジュール.有休;
    }

    get isPaidHalfHoliday() {
        return config.スケジュール.半休.filter(_ => this._schedule.includes(_)).length > 0;
    }

    get isWorked() {
        const allWorkTime = this.tr.querySelector('.all_work_time');
        return !isNaN(parseFloat(allWorkTime.innerText.trim()));
    }

    get duration() {
        let duration = 0;
        if (this.isPaidHoliday) {
            return 8;
        } else if (this.isPaidHalfHoliday) {
            // FIXME: いらないっぽいような挙動だが…
            // duration = 4;
        }
        const allWorkTime = this.tr.querySelector('.all_work_time');
        return duration + (parseFloat(allWorkTime.innerText.trim()) || 0);
    }

    get startDate() {
        // FIXME: 日付を考慮してない　が、時刻しか使ってないから一応動く
        const date = new Date();
        const start = this.tr.querySelector('[data-ht-sort-index="START_TIMERECORD"] p').innerText.trim();
        if (start.length === 0) {
            return null;
        }
        const startTime = start.split(' ')[1];
        date.setHours(...`${startTime}:00`.split(':'));
        return date;
    }

    get endDate() {
        const date = new Date();
        const end = this.tr.querySelector('[data-ht-sort-index="END_TIMERECORD"] p').innerText.trim();
        if (end.length === 0) {
            return null;
        }
        const endTime = end.split(' ')[1];
        date.setHours(...`${endTime}:00`.split(':'));
        return date;
    }
}

class RGB {
    constructor(str) {
        str = str || "";

        this.r = 0;
        this.g = 0;
        this.b = 0;

        if (str.length === 17) {
            let c = str.substring(4, 16);
            const e = c.split(",").map(_ => _.trim());
            if (e.length === 3) {
                this.r = e[0];
                this.g = e[1];
                this.b = e[2];
            }
        }
    }
}

class Parser {
    constructor(tbody) {
        this.tbody = tbody;
        this.days = [];
    }

    parse() {
        const days = Array.from(this.tbody.children);
        this.days = days.map(_ => new Day(_));
        this.totalDays = this.days.filter(_ => !_.isHoliday).length;
        this.totalTime = this.totalDays * 8;
        this.paidHolidays = this.days.filter(_ => _.isPaidHoliday).length;
        this.remainPaidHolidays = this.days.filter(_ => _.isPaidHoliday && !_.isWorked).length;
        this.paidHalfHolidays = this.days.filter(_ => _.isPaidHalfHoliday).length;
        this.remainPaidHalfHolidays = this.days.filter(_ => _.isPaidHalfHoliday).length;
        this.pastDays = this.days.filter(_ => _.isWorked).length;
        this.remainDays = this.totalDays - this.pastDays - this.remainPaidHolidays - this.remainPaidHalfHolidays * 0.5;
        this.pastTime = this.days.map(_ => _.duration).reduce((a, b) => a + b, 0);
        this.lastStartDate = this.days.filter(_ => _.startDate != null).pop();
    }
}

class Dom {
    static attachTag(rawTag, target = 'body', position = 'inner') {
        const parser = new DOMParser();
        const dom = parser.parseFromString(rawTag, 'text/html').querySelector('body');

        let tag;
        if (dom && dom.childNodes && dom.childNodes.length > 0) {
            const node = dom.childNodes[0];
            if (node) {
                tag = node;
            }
        }

        if (tag) {
            const name = tag.nodeName.toLowerCase();
            const id = tag.id;
            const currentTag = document.querySelector(`${name}#${id}`);
            if (currentTag && currentTag.parentNode) {
                currentTag.parentNode.removeChild(currentTag);
            }

            if (target !== null) {
                const targetDom = typeof target === typeof '' ? document.querySelector(target) : target;
                if (!targetDom) {
                    return null;
                }

                switch (position) {
                    case 'beforebegin':
                    case 'afterbegin':
                    case 'beforeend':
                    case 'afterend':
                        targetDom.insertAdjacentElement(position, tag);
                        break;
                    case 'inner':
                    default:
                        targetDom.appendChild(tag);
                        break;
                }
            }
        }

        return tag || null;
    }
}

class ReactModoki {
    constructor() {
        this.state = {};
        this.self = `window.__reactmodoki__.${this.constructor.name}`;

        this._render = this.render;
        this.render = this.__render;

        this.__initialized = false;
    }

    bind(func) {
        return `${this.self}.${func.name.split(' ').pop()}(...arguments)`;
    }

    setState(state, cb) {
        this.state = Object.assign(this.state, state);
        this.render();
        if (cb) {
            cb();
        }
    }

    forceUpdate(cb) {
        this.render();
        if (cb) {
            cb();
        }
    }

    __render(block) {
        if (this.parent && !block) {
            return this.parent.__render(true);
        }

        if (!this.__initialized) {
            this.__initialized = true;
            if (this.componentDidMount) {
                this.componentDidMount();
            }
        }

        let shouldUpdate = true;
        if (this.shouldComponentUpdate) {
            shouldUpdate = this.shouldComponentUpdate();
        }

        if (shouldUpdate) {
            if (this.componentWillUpdate) {
                this.componentWillUpdate();
            }

            const tag = this._render();
            const dom = Dom.attachTag(`<div id="reactmodoki-${this.constructor.name}">${tag}</div>`, this.target, this.position);

            if (this.componentDidUpdate) {
                this.componentDidUpdate();
            }

            return dom;
        }
    }

    static mount(target, position, parent = null) {
        window.__reactmodoki__ = window.__reactmodoki__ || {};
        if (!window.__reactmodoki__[this.name]) {
            try {
                window.__reactmodoki__[this.name] = new this();
                window.__reactmodoki__[this.name].target = target;
                window.__reactmodoki__[this.name].position = position;
                window.__reactmodoki__[this.name].parent = parent;
            } catch (e) {
                console.error(e);
                return null;
            }

            if (window.__reactmodoki__[this.name].componentWillMount) {
                window.__reactmodoki__[this.name].componentWillMount();
            }

            Dom.attachTag(`<div id="reactmodoki-${this.name}"></div>`, target, position);
        }

        if (target === null) {
            return window.__reactmodoki__[this.name].__render(true);
        } else if (window.__reactmodoki__[this.name].render) {
            return window.__reactmodoki__[this.name].render();
        }
    }

    static unmount() {
        window.__reactmodoki__ = window.__reactmodoki__ || {};
        if (window.__reactmodoki__[this.name].componentWillUnmount) {
            window.__reactmodoki__[this.name].componentWillUnmount();
        }
        if (window.__reactmodoki__[this.name]) {
            delete window.__reactmodoki__[this.name];
        }
    }

    static has() {
        window.__reactmodoki__ = window.__reactmodoki__ || {};
        return window.__reactmodoki__[this.name];
    }

    static embed(parent) {
        if (this.has()) {
            return this.has().__render(true).outerHTML;
        } else {
            return this.mount(null, null, parent).outerHTML;
        }
    }
}

class Info extends ReactModoki {
    constructor() {
        super();
        this.parser = null;
        this.state = {
            totalDays: 0,
            pastDays: 0,
            remainDays: 0,
            remainPaidHolidays: 0,
            pastTime: 0,
            totalTime: 0,
            todayStartDate: new Date(),
            adjustHour: 0,
        }
    }

    componentDidMount() {
        const tbody = document.querySelector('body > div > div.htBlock-mainContents > div > div.htBlock-adjastableTableF > div.htBlock-adjastableTableF_inner > table > tbody');
        const parser = new Parser(tbody);
        parser.parse();

        const {totalDays, pastDays, remainDays, remainPaidHolidays, remainPaidHalfHolidays, totalTime, pastTime, lastStartDate} = parser;

        let todayStartDate = new Date('');
        if (lastStartDate) {
            todayStartDate = lastStartDate.startDate;
        }

        this.setState({
            totalDays,
            pastDays,
            remainDays,
            remainPaidHolidays: remainPaidHolidays + remainPaidHalfHolidays * 0.5,
            totalTime,
            pastTime,
            todayStartDate,
        })
    }

    onChange(event) {
        this.setState({
            adjustHour: parseFloat(event.target.value) || 0,
        });
    }

    render() {
        const pastTime = this.state.pastTime + this.state.adjustHour;
        let averageTime = pastTime === 0 ? 0 : pastTime / this.state.pastDays;
        let minimumTime = (this.state.totalTime - pastTime) / this.state.remainDays;
        if (minimumTime < 0) {
            minimumTime = 0;
        }
        let startDate = new Date(this.state.todayStartDate.getTime());
        startDate.setSeconds(this.state.todayStartDate.getSeconds() + minimumTime * 60 * 60 + 3600);

        return String.raw`
            <h4 class="htBlock-box_subTitle">情報</h4>
            <p>今月の平日: ${this.state.totalDays}</p>
            <p>経過日数(今日を含まない): ${this.state.pastDays}</p>
            <p>残日数(今日を含む): ${this.state.remainDays}</p>
            <p>基準時間: ${this.state.totalDays * 8}</p>
            <p>合計勤務時間: ${this.state.pastTime}</p>
            <p>有休予定時間: ${this.state.remainPaidHolidays * 8}</p>
            <p>調整時間: <input type="number" onchange="${this.bind(this.onChange)}" value="${this.state.adjustHour}"></p>
            <p>残勤務時間: ${this.state.totalTime - pastTime}</p>
            <p>平均勤務時間: ${averageTime}</p>
            <p>残日数あたりの最低勤務時間: ${(this.state.totalTime - pastTime) / this.state.remainDays}</p>
            <p>残日数あたりの最大勤務時間: ${((this.state.totalTime + config.みなし残業) - pastTime) / this.state.remainDays}</p>
            <p>帰宅してもいい時刻: ${startDate.toLocaleTimeString()}</p>
        `;
    }
}

(() => {
    if (!Info.has()) {
        Info.mount('.face_template', 'afterbegin');
    }
})();
