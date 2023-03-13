class EventsList extends HTMLElement {
    static get observedAttributes() {
        return ['data-past'];
    }

    maxLength = 200;

    _past;
    _events;
    df = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' });

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async attributeChangedCallback(dataName, oldValue, newValue) {
        if (newValue === oldValue || dataName !== 'data-past') return;

        await this._render(newValue);
    }

    async connectedCallback() {
        this.shadowRoot.appendContent(await (await fetch("/elements/events-list/events-list.html")).text());
        await this._render(this.getAttribute('data-past'));
    }

    async _render(past) {
        const ul = this.shadowRoot.querySelector('ul');
        if (!ul) return;

        if (past === this._past) return;
        this._past = past;

        if (!this._events) {
            this._events = await (await fetch("/data/events.json")).json();
        }

        const {maxLength} = this;
        const today = (new Date()).toISOString().split('T')[0];
        const showPast = past === 'true';
        const rows = [];
        for (let event of this._events) {
            const dateCompared = event?.data?.eventdate?.localeCompare?.(today);
            if (dateCompared === undefined) continue;
            if ((dateCompared >= 0) === showPast) continue;

            const content = event.content.replace(/\s*[\s\r\n]+\s*/g, ' ')
                .replace(/\s*<\/?[a-z][a-z0-9]*\b.*?>\s*/gi, ' ')
                .replace(/\s{2,}/g, ' ');

            let summary;

            if (content.length > maxLength) {
                summary = content.match(new RegExp(`^(.{0,${maxLength}})[.\\s,:;!?)]`))?.[1];
                if (summary) {
                    summary = summary + '&nbsp;&hellip;';
                } else {
                    summary = content.substr(0, maxLength) + '&nbsp;&hellip;';
                }
            }

            const dt = new Date(`${event.data.eventdate}-0700`);
            rows.push(`
                <li>
                    <a href="${i18n.get('lang.url-prefix')}/events/${event.key}.html">${event.data.title}</a>
                    <p>${summary || content}</p>
                    <small>${this.df.format(dt)}${event.data.online ? `&nbsp;&middot;&nbsp;${i18n.get('event.online')}` : ''}</small>
                </li>
            `);
        }

        if (showPast) rows.reverse();

        ul.textContent = '';
        ul.appendContent(rows.join(''));
    }
}

window.customElements.define('events-list', EventsList);