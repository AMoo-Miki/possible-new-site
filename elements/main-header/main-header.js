class MainHeader extends HTMLElement {
    static get observedAttributes() {
        return ['section'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        this.shadowRoot.appendContent(await (await fetch("/elements/main-header/main-header.html")).text());

        this._instrument();
    }

    _instrument() {
        this.shadowRoot.querySelector('#trigger')?.addEventListener('click', e => {
            const {currentTarget} = e;
            e.preventDefault();
            currentTarget.setAttribute('aria-expanded', currentTarget.getAttribute('aria-expanded') !== 'true');
        });
    }
}

window.customElements.define('main-header', MainHeader);