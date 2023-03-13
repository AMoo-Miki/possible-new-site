class DocsLayout extends HTMLElement {
    static get observedAttributes() {
        return ['data-path'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        const items = await (await fetch('/assets/pages/' + i18n.get('lang.code') + '/docs/nav.json')).json();
        this.shadowRoot.appendContent(await (await fetch("/elements/docs-layout/docs-layout.html")).text(), async frag => {
            const nav = frag.querySelector('nav');
            if (!nav) return console.error('Missing "nav" element');

            for (let child; child = nav.lastChild;) nav.removeChild(child);

            nav.appendChild(this._generateNavItem(items));

            const activeLink = nav.querySelector(`a[data-rel="${this.getAttribute('data-path')}"]`);
            if (activeLink) {
                activeLink.classList.add('active');

                activeLink.parentElement.querySelector('ul')?.setAttribute('aria-expanded', 'true');

                let el = activeLink;
                do {
                    const parent = el.closest('ul');
                    if (!parent) break;

                    parent.setAttribute('aria-expanded', 'true');
                    el = el.parentElement;
                } while (true);
            }
        });

        this._instrument();
    }

    _generateNavItem(children, depth = 0) {
        const urlPrefix = i18n.get('lang.url-prefix');
        const ul = document.createElement('ul');
        if (depth) {
            ul.setAttribute('role', 'menu');
            ul.setAttribute('aria-expanded', 'false');
        }

        for (let child of children) {
            const hasChildren = Array.isArray(child.children) && child.children.length;
            const li = document.createElement('li');

            /*
            if (child.rel !== undefined) {
                const a = document.createElement('a');
                a.textContent = child.title;
                a.setAttribute('href', `${urlPrefix}/docs/${child.rel}`);
                a.setAttribute('data-rel', child.rel);
                li.appendChild(a);
            } else {
                const div = document.createElement('div');
                div.textContent = child.title;
                li.appendChild(div);
            }
             */

            if (depth === -1 && child.rel === undefined) {
                const div = document.createElement('div');
                div.textContent = child.title;
                li.appendChild(div);
            } else {
                const a = document.createElement('a');
                a.textContent = child.title;
                if (child.rel !== undefined) {
                    a.setAttribute('href', `${urlPrefix}/docs/${child.rel}`);
                    a.setAttribute('data-rel', child.rel);
                    li.appendChild(a);
                } else {
                    a.setAttribute('href', `#`);
                    a.setAttribute('data-expander', 'true');
                }
                li.appendChild(a);
            }


            if (hasChildren) {
                li.appendChild(this._generateNavItem(child.children, depth + 1));

                const chevron = document.createElement('a');
                chevron.classList.add('expander');
                chevron.setAttribute('href', '#');
                chevron.innerHTML = '<svg viewBox="0 0 24 24"><use xlink:href="#svg-chevron"></use></svg>';
                chevron.setAttribute('aria-haspopup', 'menu');
                li.appendChild(chevron);
            }

            ul.appendChild(li);
        }

        return ul;
    }

    _instrument() {
        const nav = this.shadowRoot.querySelector('nav');
        nav.delegateEventListener('click', 'a.expander, a[data-expander]', function (e) {
            if (e.which === 3 || e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey) return;
            e.preventDefault();
            const subMenu = this.parentElement.querySelector('ul');
            if (!subMenu) return console.error('Missing sub-menu "ul" element');

            subMenu.setAttribute('aria-expanded', subMenu.getAttribute('aria-expanded') === "false");
        });

        this.shadowRoot.querySelector('.trigger')?.addEventListener('click', e => {
            e.preventDefault();
            nav.setAttribute('aria-expanded', nav.getAttribute('aria-expanded') === "false");
        });
    }
}

window.customElements.define('docs-layout', DocsLayout);