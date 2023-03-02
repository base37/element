const Element = Object.defineProperties({}, {
    version: {configurable: false, enumerable: true, writable: false, value: '1.0.0'}, 
    repositories: {configurable: false, enumerable: true, writable: false, value: {}}, 
    suffixes: {configurable: false, enumerable: true, writable: false, value: {}}, 
    ids: {configurable: false, enumerable: true, writable: false, value: {}}, 
    tagNames: {configurable: false, enumerable: true, writable: false, value: {}}, 
    extends: {configurable: false, enumerable: true, writable: false, value: {}}, 
    files: {configurable: false, enumerable: true, writable: false, value: {}}, 
    styles: {configurable: false, enumerable: true, writable: false, value: {}}, 
    templates: {configurable: false, enumerable: true, writable: false, value: {}}, 
    scripts: {configurable: false, enumerable: true, writable: false, value: {}}, 
    classes: {configurable: false, enumerable: true, writable: false, value: {}}, 
    constructors: {configurable: false, enumerable: true, writable: false, value: {}}, 
    _extendsRegExp: {configurable: false, enumerable: false, writable: false, 
        value: /class\s+extends\s+Element\.classes((\.(?<extends1>.+))|(\["(?<extends2>.+)"\])|(\['(?<extends3>.+)'\])|(\[(?<extends4>.+)\]))\s+\{/}, 
    _isNative: {configurable: false, enumerable: false, writable: false, value: function(tagName) {
        return tagName && ((tagName.startsWith('HTML') && tagName.endsWith('Element')) || tagName == 'Image' || tagName == 'Audio')
    }},
    autoload: {configurable: false, enumerable: true, writable: false, value: async function() {
        this._enscapulateNative()
        const observer = new MutationObserver(mutationList => {
            mutationList.forEach(mutationRecord => {
                mutationRecord.addedNodes.forEach(addedNode => {
                    if (addedNode.tagName.includes('-')) {
                        this.activateTag(addedNode.tagName)
                    }
                })
            })
        })
        observer.observe(document, {subtree: true, childList: true, attributes: false})
        Array.from(new Set(Array.from(document.querySelectorAll('*')).filter(element => element.tagName.indexOf('-') > 0).map(element => element.tagName.toLowerCase()))).sort()
            .forEach(async customTag => await this.activateTag(customTag))
    }}, 
    getInheritance: {configurable: false, enumerable: true, writable: false, value: function(tagId='HTMLElement') {
        let inheritance = [tagId], count = 1000
        while (count && tagId &&  !this._isNative(tagId) && this.extends[tagId]) { 
            inheritance.push(this.extends[tagId])
            tagId = this.extends[tagId] 
            count = count - 1
        }
        return inheritance
    }},
    sortByInheritance: {configurable: false, enumerable: true, writable: false, value: function(tagIdList) {
        return Array.from(new Set(tagIdList)).filter(t => this.extends[t]).sort((a, b) => {
            if (this.extends[a] == b) {
                return -1
            } else if (this.extends[b] == a) {
                return 1
            } else {
                return this.getInheritance(b).indexOf(a)
            }
        }).map((v, i, a) => (i == a.length-1) ? [v, this.extends[v]] : v).flat()
    }}, 
    stackTemplates: {configurable: false, enumerable: true, writable: false, value: async function(tagId, templateInnerHTML=undefined) {
        const template = document.createElement('template')
        template.innerHTML = templateInnerHTML || this.templates[tagId]
        for (const t of template.content.querySelectorAll('template[id]')) {
            const idAttr = t.getAttribute('id'), tId = idAttr.match(/^[a-z0-9]+-[a-z0-9]+/) ? this.getTagId(idAttr): idAttr, 
                tNode = document.createElement('template')
            if (!this.templates[tId]) {
                await this.loadTagAssetsFromId(tId)
            }
            tNode.innerHTML = await this.stackTemplates(tId)
            const clonedNode = tNode.content.cloneNode(true)
            if (t.hasAttribute('slot')) {
                const tSlot = t.getAttribute('slot'), targetSlot = clonedNode.querySelector(`slot[name="${tSlot}"]`) 
                    || tSlot ? clonedNode.querySelector(tSlot) : clonedNode.querySelector('slot') 
                    || clonedNode.querySelector('slot')
                if (targetSlot)  {
                    targetSlot.replaceWith(await this.stackTemplates(undefined, t.innerHTML))
                }
            }
            t.replaceWith(clonedNode)
        }
        return template.innerHTML
    }}, 
    stackStyles: {configurable: false, enumerable: true, writable: false, value: function(tagId) {
        return this.getInheritance(tagId).reverse().filter(tId => !this._isNative(tId)).map(tId => `/** ${tId} styles */\n\n` + this.styles[tId]).join("\n\n\n")
    }}, 
    getTagId: {configurable: false, enumerable: true, writable: false, value: function(tagName) {
        const [tagRepository, tagComponent] = tagName.split('-', 2).map(t => t.toLowerCase())
        return `${this.repositories[tagRepository] || ('./'+tagRepository+'/')}${tagComponent}${this.suffixes[tagRepository] || '.html'}`
    }}, 
    loadTagAssetsFromId: {configurable: false, enumerable: true, writable: false, value: async function(tagId, forceReload=false) {
        if (forceReload || !this.files[tagId]) {
            this.files[tagId] = await fetch(tagId).then(r => r.text())
            this.styles[tagId] = this.files[tagId].slice(this.files[tagId].indexOf('<style>')+7, this.files[tagId].indexOf('</style>')).trim()
            this.templates[tagId] = this.files[tagId].slice(this.files[tagId].indexOf('<template>')+10, this.files[tagId].indexOf('</template>')).trim()
            this.scripts[tagId] = this.files[tagId].slice(this.files[tagId].indexOf('<script>')+8, this.files[tagId].indexOf('</script>'))
                                        .trim()
            const extendsClassAliasGroups = this.scripts[tagId].match(this._extendsRegExp)?.groups, 
                extendsClassAlias = extendsClassAliasGroups ? (extendsClassAliasGroups.extends1 || extendsClassAliasGroups.extends2 || extendsClassAliasGroups.extends3 || extendsClassAliasGroups.extends4) : undefined, 
                extendsClassId = extendsClassAlias.match(/^[a-z0-9]+-[a-z0-9]+$/) ? this.getTagId(extendsClassAlias) : extendsClassAlias
            if (extendsClassId) {
                this.extends[tagId] = extendsClassId
                if (!this.files[extendsClassId] && !this._isNative(extendsClassId)) {
                    await this.loadTagAssetsFromId(extendsClassId)
                }            
            }
            this.classes[tagId] = Function('Element', 'return ' + this.scripts[tagId])(this)
        }
    }}, 
    activateTag: {configurable: false, enumerable: true, writable: false, value: async function(tagName, forceReload=false) {
        if (tagName.includes('-') && (forceReload || !this.ids[tagName]))  {
            const tagId = this.getTagId(tagName)
            this.ids[tagName] = tagId
            this.tagNames[tagId] = tagName
            await this.loadTagAssetsFromId(tagId, forceReload)
            const Element = this
            this.constructors[tagId] = class extends this.classes[tagId] {
                __tagId = tagId
                constructor() {
                    super()
                    const shadowRoot = this.shadowRoot || this.attachShadow({mode: 'open'})
                    shadowRoot.innerHTML = ''
                    const styleNode = document.createElement('style')
                    styleNode.innerHTML = Element.stackStyles(tagId)
                    shadowRoot.appendChild(styleNode)
                    const templateNode = document.createElement('template')
                    Element.stackTemplates(tagId).then(innerHTML => {
                        templateNode.innerHTML = innerHTML
                        shadowRoot.appendChild(templateNode.content.cloneNode(true))
                    })
                }
            }
            const baseTagName = this.getInheritance(tagId).pop() || 'HTMLElement'
            if (baseTagName != 'HTMLElement' && this._isNative(baseTagName)) {
                globalThis.customElements.define(tagName, this.constructors[tagId], {extends: baseTagName})
            } else {
                globalThis.customElements.define(tagName, this.constructors[tagId])
            }
        }
    }}, 
    render: {configurable: false, enumerable: true, writable: false, value: async function(element, tagId, renderFunction=true, style=true, template=true) {
        if (element?.shadowRoot && typeof element.shadowRoot?.querySelector == 'function' && typeof element.shadowRoot?.prepend == 'function') {
            const useStyle = style && typeof style == 'string' ? (this.styles[style] ? this.styles[style] : style) : undefined
            useStyle = useStyle || (style && typeof style == 'boolean' && tagId && this.styles[tagId] ? this.styles[tagId] : undefined)
            useStyle = style === false ? undefined : useStyle
            if (useStyle) {
                const styleNode = document.createElement('style'), existingStyleNode = element.shadowRoot.querySelector('style')
                styleNode.innerHTML = useStyle
                existingStyleNode.after(styleNode)
            }
            const useTemplate = template && typeof template == 'string' ? (this.templates[template] ? this.templates[template] : template) : undefined
            useTemplate = useTemplate || (template && typeof template == 'boolean' && tagId && this.templates[tagId] ? this.templates[tagId] : undefined)
            useTemplate = template === false ? undefined : useTemplate
            if (useTemplate) {
                const mainStyleNode = element.shadowRoot.querySelector('style'), renderStyleNode = element.shadowRoot.querySelector('style + style')
                mainStyleNode = mainStyleNode ? mainStyleNode.cloneNode(true) : undefined
                renderStyleNode = renderStyleNode ? renderStyleNode.cloneNode(true) : undefined
                element.shadowRoot.innerHTML = await this.stackTemplates(undefined, useTemplate)
                if (renderStyleNode) {
                    element.shadowRoot.prepend(renderStyleNode)
                }
                if (mainStyleNode) {
                    element.shadowRoot.prepend(mainStyleNode)
                }
            }
            const renderFunction = renderFunction && typeof renderFunction == 'function' ? renderFunction : undefined
            renderFunction = renderFunction || (renderFunction && typeof renderFunction == 'boolean' && tagId && this.constructors[tagId] && typeof this.constructors[tagId].__render == 'function' ? this.constructors[tagId].__render : undefined)
            renderFunction = renderFunction === false ? undefined : renderFunction
            if (renderFunction && typeof renderFunction == 'function') {
                await renderFunction(element, tagId, style, template)
            }
        }
    }}, 
    _enscapulateNative: {configurable: false, enumerable: false, writable: false, value: function() {
        Reflect.ownKeys(globalThis).filter(k => this._isNative(k)).forEach(nativeClassName => {
            if (!this.classes[nativeClassName]) {
                if (nativeClassName == 'HTMLImageElement') {
                    this.classes[nativeClassName] = globalThis['Image']
                } else if (nativeClassName == 'HTMLAudioElement') {
                    this.classes[nativeClassName] = globalThis['Audio']
                } else {
                    this.classes[nativeClassName] = globalThis[nativeClassName]
                }
            }
            if (!this.constructors[nativeClassName]) {
                this.constructors[nativeClassName] = this._base(this.classes[nativeClassName])
            }
        })
    }}, 
    _base: {configurable: false, enumerable: false, writable: false, value: function(baseClass=globalThis.HTMLElement) {
        return class extends baseClass {
            constructor() {
                super()
                const $this = this, attributeFilter = [...$this.constructor.observedAttributes]
                Object.defineProperty($this, '__dict', {configurable: false, enumerable: false, value: {}})
                ;($this.constructor.observedAttributes || []).forEach(attrName => {
                    const canonicalAttrName = attrName.toLowerCase(), setterFunc = (typeof $this[attrName] === 'function') ? $this[attrName] : undefined
                    if (!attributeFilter.includes(canonicalAttrName)) {
                        attributeFilter.push(canonicalAttrName)
                    }
                    delete $this[attrName]
                    Object.defineProperty($this, attrName, {configurable: false, enumerable: true, set: (value) => {
                        $this.__dict[canonicalAttrName] = setterFunc ? setterFunc($this, value) : value
                        if (['string', 'number', 'boolean'].includes(typeof $this.__dict[canonicalAttrName])) {
                            const newAttributeValue = $this.__dict[canonicalAttrName], currentAttributeValue = $this.hasAttribute(canonicalAttrName) ? $this.getAttribute(canonicalAttrName) 
                                : ($this.hasAttribute(attrName) ? $this.getAttribute(attrName) : null) 
                            if (String(currentAttributeValue) != String(newAttributeValue)) {
                                $this.setAttribute(canonicalAttrName, String(newAttributeValue))
                            }
                        } else {
                            $this.removeAttribute(canonicalAttrName)
                        }
                    }, get: () => {
                        if (canonicalAttrName in $this.__dict) {
                            return $this.__dict[canonicalAttrName]
                        } else {
                            try {
                                $this[attrName] = $this.getAttribute(canonicalAttrName) ?? $this.getAttribute(attrName) ?? undefined
                            } catch(e) {
                                $this.__dict[canonicalAttrName] = $this.getAttribute(canonicalAttrName) ?? $this.getAttribute(attrName) ?? undefined
                            }
                            return $this.__dict[canonicalAttrName]
                        }
                    } })
                    if (canonicalAttrName != attrName) {
                        Object.defineProperty($this, canonicalAttrName, {configurable: false, enumerable: false, set: (value) => {
                            $this[attrName] = value
                        }, get: () => $this[attrName] })
                    }
                })
                ;($this.constructor.js || []).forEach(src => {
                    const tag = document.querySelector(`script[src="${src}"]`)
                    if (!tag) {
                        tag = document.createElement('script')
                        tag.setAttribute('src', src)
                        document.body.append(tag)
                    }
                })
                ;($this.constructor.css || []).forEach(href => {
                    const tag = document.querySelector(`link[rel="stylesheet"][href="${href}"]`)
                    if (!tag) {
                        tag = document.createElement('link')
                        tag.setAttribute('rel', 'stylesheet')
                        tag.setAttribute('href', href)
                        document.head.append(tag)
                    }
                })
                $this.__queuedAttributes = {}
                const observer = new MutationObserver(mutationList => {
                    mutationList.forEach(mutationRecord => {
                        if (String($this[mutationRecord.attributeName]) != $this.getAttribute(mutationRecord.attributeName)) {
                            $this[mutationRecord.attributeName] = $this.getAttribute(mutationRecord.attributeName)
                        }
                    })
                })
                observer.observe($this, {subtree: false, childList: false, attributes: true, attributeFilter: attributeFilter, attributeOldValue: true})
            }
            processQueuedAttributes() {
                const $this = this
                Object.keys($this.__queuedAttributes).filter(k => {
                    return $this.__queuedAttributes[k].requires && typeof $this.__queuedAttributes[k].requires == 'function' ? $this.__queuedAttributes[k].requires() : true
                }).forEach(k => {
                    if ($this.__queuedAttributes[k].attribute && $this.__queuedAttributes[k].value) {
                        $this.setAttribute($this.__queuedAttributes[k].attribute, $this.__queuedAttributes[k].value)
                        if (typeof $this.__queuedAttributes[k].callback == 'function') {
                            $this.__queuedAttributes[k].callback()
                        }
                    }
                    delete $this.__queuedAttributes[k]
                })
                if (!Object.keys($this.__queuedAttributes).length) {
                    globalThis.clearInterval($this.__queuedAttributeInterval)
                }
            }
            addQueuedAttribute(attribute, value, requires, callback) {
                const $this = this
                $this.__queuedAttributes[`${Date.now()}-${parseInt(Math.random() * 1000000)}`] = {attribute: attribute, value: value, requires: requires, callback: callback}
                $this.__queuedAttributeInterval = $this.__queuedAttributeInterval || globalThis.setInterval(function() {
                    $this.processQueuedAttributes()
                }, 1000)
            }
            static get observedAttributes() {
                return []
            }
            attributeChangedCallback(attrName, oldVal, newVal) {
                this[attrName] = newVal
            }



            hasAttributes(...attributes) {
                const $this = this
                return Object.assign({}, ...attributes.map(a => {
                    if (a && typeof a == 'object') {
                        return Object.assign({}, ...Object.keys(a).map(aa => {
                            return {[aa]: $this.shadowRoot.querySelector(`[name="${aa}"]`).hasAttributes(...a[aa])}
                        }))
                    } else {
                        return {[a]: $this.hasAttribute(a)} 
                    }
                }))
            }




            getAttributes(...attributes) {
                const $this = this
                return Object.assign({}, ...attributes.map(a => ({[a]: $this.getAttribute(a)})))
            }
            removeAttributes(...attributes) {
                const $this = this
                attributes.forEach(a => $this.removeAttribute(a))
            }
            toggleAttributes(...attributes) {
                const $this = this
                return Object.assign({}, ...attributes.map(a => ({[a]: $this.toggleAttribute(a)})))
            }
            setAttributes(attributes) {
                const $this = this
                attributes.forEach(a => {
                    if (a instanceof Object) {
                        Object.keys(a).forEach(k => $this.setAttribute(k, a[k]))
                    } else if (typeof a == 'string') {
                        $this.setAttribute(a, '')
                    }
                })
            }
        }
    }}
})
export { Element }