class MainFooter extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        this.shadowRoot.appendContent(await (await fetch("/elements/main-footer/main-footer.html")).text());
    }
}

window.customElements.define('main-footer', MainFooter);