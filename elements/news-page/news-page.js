class NewsPage extends HTMLElement {
    static get observedAttributes() {
        return ['data-page'];
    }

    maxLength = 200;
    maxShown = 5;

    _page;
    _posts;
    df = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async attributeChangedCallback(dataName, oldValue, newValue) {
        if (newValue === oldValue || dataName !== 'data-page') return;

        await this._render(newValue);
    }

    async connectedCallback() {
        this.shadowRoot.appendContent(await (await fetch("/elements/news-page/news-page.html")).text());
        this._page = parseInt(this.getAttribute('data-page'));
    }

    async _render(page) {
        const ul = this.shadowRoot.querySelector('ul.news');
        if (!ul) return;

        let {maxShown, maxLength, _posts} = this;
        if (!_posts) {
            this._posts = _posts = await (await fetch("/data/posts.json")).json();
        }

        const rows = [];
        let p = parseInt(page) || 0;
        const lastPageIdx = Math.ceil(_posts.length / maxShown) - 1;
        p = p < 0 ? 0 : p > lastPageIdx ? lastPageIdx : p;

        if (p === this._page) return;
        this._page = p;

        const start = p * maxShown;

        for (let i = 0; i < 5; i++) {
            const post = _posts[start + i];

            const content = post.content.replace(/\s*[\s\r\n]+\s*/g, ' ')
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

            const dt = new Date(`${post.data.date}-0700`);
            rows.push(`
                <li>
                    <a href="${i18n.get('lang.url-prefix')}/blog/${post.category}/${post.key}.html">${event.data.title}</a>
                    <small>${this.df.format(dt)}</small>
                    <p>${summary}</p>
                    <read-more href="${i18n.get('lang.url-prefix')}/blog/${post.category}/${post.key}.html"></read-more>
                </li>
            `);
        }

        ul.textContent = '';
        ul.appendContent(rows.join(''));
    }
}

window.customElements.define('news-page', NewsPage);