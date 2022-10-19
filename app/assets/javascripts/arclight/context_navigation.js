class NavigationDocument {
  /**
   * @param {Element} el - the <article> element
   */
  constructor(el) {
    this.el = el
  }

  get id() {
    return this.el.querySelector('[data-document-id]').dataset.documentId
  }

  setAsHighlighted() {
    this.el.querySelector('li.al-collection-context').classList.add('al-hierarchy-highlight')
  }

  makeCollapsible() {
    this.el.querySelector('li.al-collection-context').classList.add('collapsible')
  }

  collapse() {
    this.el.querySelector('li.al-collection-context').classList.add('collapsed')
  }

  /**
   * @return {Element} the <li> element that was within the <article>
   */
  render() {
    return this.el.firstElementChild
  }
}

/**
 * Models the "Expand"/"Collapse" button, and provides an onClick event handler
 * for the jQuery element
 * @class
 */
class ExpandButton {
  /**
   * This retrieves the <li> elements which are hidden/rendered in response to
   *   clicking the <button> element
   * @param {jQuery} $li - the <button> element
   * @return {jQuery} - a jQuery object containing the targeted <li>
   */
  findCollapsibleSiblings() {
    const $siblings = this.$el.parent().children('li.collapsible');
    return $siblings;
  }

  /**
   * This adds a "collapsed" class to all of the <li> children, as well as
   *   updates the text for the <button> element
   * @param {Event} event - the event propagated in response to clicking on the
   *   <button> element
   */
  handleClick() {
    const $targeted = this.findCollapsibleSiblings();

    $targeted.toggleClass('collapsed');
    this.$el.toggleClass('collapsed');

    const containerText = this.$el.hasClass('collapsed') ? this.collapseText : this.expandText;
    this.$el.text(containerText);
  }

  /**
   * @constructor
   */
  constructor(data) {
    this.collapseText = data.collapse;
    this.expandText = data.expand;

    this.$el = $(`<button class="my-3 btn btn-secondary btn-sm">${this.expandText}</button>`);
    this.handleClick = this.handleClick.bind(this);
    this.$el.click(this.handleClick);
  }
}

/**
 * Models the placeholder display elements for content loading from AJAX
 *   requests
 * @class
 */
class Placeholder {
  /*
   * Builds the element set which contains the placeholder markup
   *   classes
   */
  static after(element) {
    const elementMarkup = `<div class="al-hierarchy-placeholder">
      <h3 class="col-md-9"></h3>
      <p class="col-md-6"></p>
      <p class="col-md-12"></p>
      <p class="col-md-3"></p>
      </div>`
    const markup = Array(3).join(elementMarkup).trim()
    const template = document.createElement('template')
    template.innerHTML = markup
    element.after(template.content)
  }
}

class ContextNavigation {
  constructor(el, originalParents = null, originalDocument = null) {
    this.el = $(el);
    this.data = this.el.data();
    this.parentLi = this.el.parent();
    this.eadid = this.data.arclight.eadid;
    this.originalParents = originalParents; // let originalParents stay null
    this.originalDocument = originalDocument || this.data.arclight.originalDocument;
    this.ul = document.createElement('ul')
    this.ul.classList.add('al-context-nav-parent')
  }

  // Gets the targetId to select, based off of parents and current level
  get targetId() {
    if (this.originalParents && this.originalParents[this.data.arclight.level]) {
      return `${this.eadid}${this.originalParents[this.data.arclight.level]}`;
    }
    return this.data.arclight.originalDocument;
  }

  get requestParent() {
    // Cases where you're viewing a component page (use its ancestor trail)...
    if (this.originalParents && this.originalParents[this.data.arclight.level - 1]) {
      return this.originalParents[this.data.arclight.level - 1];
    }
    // Cases where there are no parents provided...
    //   1) when on a top-level collection page
    //   2) when +/- gets clicked
    return this.data.arclight.originalDocument.replace(this.eadid, '');
  }

  getData() {
    // Add a placeholder so flashes of text are not as significant
    Placeholder.after(this.el)

    const params = new URLSearchParams({
      'f[component_level_isim][]': this.data.arclight.level,
      'f[collection_sim][]': this.data.arclight.name,
      'f[parent_ssi][]': this.requestParent,
      original_document: this.originalDocument,
      view: 'collection_context'
    });
    if (this.data.arclight.access) {
      params.append('f[has_online_content_ssim][]', this.data.arclight.access);
    }
    if (this.data.arclight.search_field) {
      params.append('search_field', this.data.arclight.search_field);
    }
    this.data.arclight.originalParents?.forEach((value, i) => params.append(`original_parents[${i}]`, value));

    fetch(this.data.arclight.path + '&' + params)
      .then((response) => response.text())
      .then((data) => this.updateView(data));
  }

  /**
   * Constructs a <ul> container element with an ElementButton instance appended
   * within it
   * @returns {jQuery}
   */
  buildExpandList() {
    const $ul = $('<ul></ul>');
    $ul.addClass('pl-0');
    $ul.addClass('prev-siblings');
    const button = new ExpandButton(this.data);
    $ul.append(button.$el);
    return $ul[0];
  }

  /**
   * Highlights the <li> element for the current Document and appends <li> the
   *   sibling documents for a given Document element
   * @param {NavigationDocument[]} newDocs - the NavigationDocument objects for
   *   each resulting Solr Document
   * @param {number} originalDocumentIndex
   */
  updateSiblings(newDocs, originalDocumentIndex) {
    newDocs[originalDocumentIndex].setAsHighlighted();

    // Hide all but the first previous sibling
    const prevSiblingDocs = newDocs.slice(0, originalDocumentIndex);
    let nextSiblingDocs = [];

    if (prevSiblingDocs.length > 1 && originalDocumentIndex > 0) {
      const hiddenPrevSiblingDocs = prevSiblingDocs.slice(0, -1);
      hiddenPrevSiblingDocs.forEach(siblingDoc => {
        siblingDoc.makeCollapsible();
        siblingDoc.collapse();
      });

      const prevSiblingList = this.buildExpandList()
      prevSiblingDocs.map(doc => prevSiblingList.append(doc.render()))

      this.ul.append(prevSiblingList)

      nextSiblingDocs = newDocs.slice(originalDocumentIndex);
    } else {
      nextSiblingDocs = newDocs;
    }

    // Insert the rendered sibling documents before the <li> elements
    nextSiblingDocs.map(doc => this.ul.append(doc.render()))

    this.el.html($(this.ul))
  }

  /**
   * Inserts <li> elements for parents (e. g. components or collections) for the
   *   current Document and appends <li> for each of these
   * @param {NavigationDocument[]} newDocs - the NavigationDocument objects for
   *   each resulting Solr Document
   */
  updateParents(newDocs) {
    // Case where this is a parent list and needs to be filed correctly
    //
    // Otherwise, retrieve the parent...
    let newDocIndex = newDocs.findIndex(doc => doc.id === this.targetId);

    if (newDocIndex === -1) {
      newDocs.map(newDoc => this.ul.append(newDoc.render()))
      this.el.html($(this.ul))
      return;
    }
    // Update the docs before the item
    // Retrieves the documents up to and including the "new document"
    const beforeDocs = newDocs.slice(0, newDocIndex);
    if (beforeDocs.length > 1) {
      beforeDocs.forEach(function (parentDoc) {
        parentDoc.makeCollapsible();
        parentDoc.collapse();
      });
      const prevParentList = this.buildExpandList()
      beforeDocs.map(doc => prevParentList.append(doc.render()))
      this.ul.append(prevParentList)
    } else {
      beforeDocs.map(newDoc => this.ul.append(newDoc.render()))
    }

    const itemDoc = newDocs.slice(newDocIndex, newDocIndex + 1)[0]

    // Update the item
    const renderedItemDoc = itemDoc.render()
    this.ul.append(renderedItemDoc)

    // Update the docs after the item
    const afterDocs = newDocs.slice(newDocIndex + 1, newDocs.length)

    // Insert the documents after the current
    afterDocs.map(newDoc => this.ul.append(newDoc.render()))
    this.el.html($(this.ul))

    // Initialize additional things
    renderedItemDoc.querySelectorAll('[data-controller="arclight-context-navigation"]').forEach((element) => {
      const contextNavigation = new ContextNavigation(
        element, this.originalParents, this.originalDocument
      );
      contextNavigation.getData();
    });
  }

  /**
   * This updates the elements in the View DOM using an AJAX response containing
   *   the HTML of a server-rendered View template.
   * It is this which is primarily used to populate the <ul> element with
   *   children for the navigation context, containing <li> elements for
   *   collections, components, and containers.
   * @param {string} response - the AJAX response body
   */
  updateView(response) {
    const parser = new DOMParser();
    const html = parser.parseFromString(response, 'text/html');
    const newDocs = Array.from(html.querySelectorAll('#documents article'))
      .map(el => new NavigationDocument(el));

    // See if the original document is located in the returned documents
    const originalDocumentIndex = newDocs.findIndex(doc => doc.id === this.originalDocument);
    this.parentLi.find('.al-hierarchy-placeholder').remove();

    // If the original document in the results, update it. If not update with a
    // more complex procedure
    if (originalDocumentIndex !== -1) {
      this.updateSiblings(newDocs, originalDocumentIndex);
    } else {
      this.updateParents(
        newDocs,
        this.data.arclight.originalParents,
        this.data.arclight.parent,
        this.parentLi
      );
    }
    this.el.parent().data('resolved', true);
    this.addListenersForPlusMinus();
    this.el.trigger('navigation.contains.elements');
  }

  // eslint-disable-next-line class-methods-use-this
  findTarget(name) {
    return document.querySelector(`[data-arclight-context-navigation-target="${name}"`);
  }

  addListenersForPlusMinus() {
    $(this.ul).find('.al-toggle-view-children').on('click', (e) => {
      e.preventDefault();
      const targetArea = $($(e.currentTarget).attr('href'));
      if (!targetArea.data('resolved') === true) {
        const areaTag = targetArea[0];
        areaTag.querySelectorAll('[data-controller="arclight-context-navigation"]').forEach((element) => {
          const contextNavigation = new ContextNavigation(
            // Send null for originalParents. We want to disregard the original
            // component's ancestor trail and instead use the current ID as the
            // parent in the query to populate the navigator.
            element, null, this.originalDocument
          );
          contextNavigation.getData();
        });
      }
    });
  }
}

/**
 * Integrate the behavior into the DOM using the Blacklight#onLoad callback
 *
 */
Blacklight.onLoad(function () {
  document.querySelectorAll('[data-controller="arclight-context-navigation"]').forEach((element) => {
    const contextNavigation = new ContextNavigation(
        element,
        $(element).data('arclight').originalParents,
        $(element).data('arclight').originalDocument
      );
    contextNavigation.getData();
  });
});
