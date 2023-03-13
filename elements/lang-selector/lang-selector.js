class LangSelector extends HTMLElement {
    static get observedAttributes() {
        return ['expanded'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this._boundCheckFocusOutsideLang = this._checkFocusOutsideLang.bind(this);
    }

    async connectedCallback() {
        this.shadowRoot.appendContent(await (await fetch("/elements/lang-selector/lang-selector.html")).text(), frag => {
            this._populateDropDown(frag);
            this._populateCurrentLang(frag);
        });

        this._instrument();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (newValue === oldValue) return;

        if (name === 'expanded') {
            return this.expand(newValue === 'true');
        }
    }

    get expanded() {
        return !!this.shadowRoot.querySelector('.trigger[aria-expanded="true"]');
    }

    expand(flag) {
        const {shadowRoot} = this;
        const trigger = shadowRoot.querySelector('.trigger');
        if (!trigger) return;

        if (flag === this.expanded) return;

        if (flag === false) {
            window.removeEventListener('mousedown', this._boundCheckFocusOutsideLang, true);
            trigger.setAttribute('aria-expanded', 'false');
            this.removeAttribute('expanded');
        } else {
            window.addEventListener('mousedown', this._boundCheckFocusOutsideLang, true);
            trigger.setAttribute('aria-expanded', 'true');
            this.setAttribute('expanded', 'true');
        }
    }

    _populateCurrentLang(frag) {
        frag.querySelector('.current').textContent = window.SUPPORTED_LANGS[window.CURRENT_LANG || 'en'];
    }

    _populateDropDown(frag) {
        const selectableLangs = {...window.SUPPORTED_LANGS};
        delete selectableLangs[window.CURRENT_LANG || 'en'];

        // ToDo: Remove these checks when multilingualism is finalized
        let isMultilingual = false;
        for (let key in selectableLangs) {
            isMultilingual = true;
            break;
        }

        const langDropDown = frag.querySelector('.dropdown');

        if (isMultilingual) {
            for (let child of langDropDown.childNodes) {
                if (child.tagName === 'A') langDropDown.removeChild(child);
            }
            for (let key in selectableLangs) {
                const a = document.createElement('a');
                a.setAttribute('href', `/${key}`);
                a.setAttribute('data-key', key);
                a.setAttribute('routable', 'false');
                a.textContent = selectableLangs[key];
                langDropDown.appendChild(a);
            }
        } else {
            this.style.display = 'none';
        }
    }

    _instrument() {
        const {shadowRoot} = this;

        shadowRoot.querySelector('.trigger').addEventListener('click', e => {
            e.preventDefault();
            this.expand(!this.expanded);
        });

        shadowRoot.querySelector('.dropdown').addEventListener('click', e => {
            const lang = e.target.getAttribute('data-key');
            const path = document.documentElement.getAttribute('data-path');
            e.target.setAttribute('href', (lang && lang !== 'en' ? `/${lang}` : '') + (path && path !== 'home' ? `/${path}` : '/'));
        });
    }

    _checkFocusOutsideLang(e) {
        if (!this.shadowRoot.contains(e.originalTarget)) this.expand(false);
    }
}

window.customElements.define('lang-selector', LangSelector);