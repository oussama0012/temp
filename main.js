// ... existing code ...

function showModal(options) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-container';
    
    const title = document.createElement('div');
    title.className = 'modal-title';
    title.textContent = options.title || 'Notification';
    
    const message = document.createElement('div');
    message.className = 'modal-message';
    message.textContent = options.message || '';
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'modal-buttons';
    
    modalContainer.appendChild(title);
    modalContainer.appendChild(message);
    
    // Add content if provided via function
    if (options.content && typeof options.content === 'function') {
        const contentElement = options.content();
        modalContainer.appendChild(contentElement);
    }
    
    // Add input if needed
    let inputElement = null;
    if (options.input) {
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.className = 'modal-input';
        inputElement.value = options.inputValue || '';
        inputElement.placeholder = options.inputPlaceholder || '';
        modalContainer.appendChild(inputElement);
    }
    
    // Create buttons
    if (options.buttons) {
        options.buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = `modal-btn ${button.primary ? 'modal-btn-primary' : 'modal-btn-secondary'}`;
            btn.textContent = button.text;
            btn.onclick = () => {
                document.body.removeChild(backdrop);
                if (button.callback) {
                    if (inputElement) {
                        button.callback(inputElement.value);
                    } else {
                        button.callback();
                    }
                }
            };
            buttonsContainer.appendChild(btn);
        });
    }
    
    modalContainer.appendChild(buttonsContainer);
    backdrop.appendChild(modalContainer);
    document.body.appendChild(backdrop);
    
    if (inputElement) {
        setTimeout(() => inputElement.focus(), 100);
    }
    
    return {
        close: () => {
            if (document.body.contains(backdrop)) {
                document.body.removeChild(backdrop);
            }
        }
    };
}

class NotepadApp {
    constructor() {
        // Initialize the notepad application
        this.setupEditor();
        this.setupEventListeners();
        this.loadSavedNotes();
        this.setupWordCounter(); 
        this.setupSavedFilesToggle();
        this.loadNotepadContent(); 
        this.addBlockquoteExitBehavior();
    }
    
    setupEditor() {
        // Set up the editor with initial state
        this.notepad = document.getElementById('notepad');
        this.lastSavedContent = this.notepad.innerHTML;
        document.execCommand('defaultParagraphSeparator', false, 'p');

        // Initialize custom history stack
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50; // Limit history size

        // Save initial state
        this.saveHistoryState();

        // Add event listener for content changes
        this.notepad.addEventListener('input', () => {
            localStorage.setItem('currentNotepadContent', this.notepad.innerHTML);
            this.saveHistoryState(); // Save state on each input
        });
    }

    saveHistoryState() {
        // Save the current state of the editor to the history
        const currentState = this.notepad.innerHTML;

        // Trim history if it exceeds max size
        if (this.history.length >= this.maxHistorySize) {
            this.history.shift(); // Remove oldest state
            this.historyIndex = Math.max(0, this.historyIndex - 1); // Adjust index if necessary
        }

        // If not at the end of history, truncate the history
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(currentState);
        this.historyIndex = this.history.length - 1;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.notepad.innerHTML = this.history[this.historyIndex];
            localStorage.setItem('currentNotepadContent', this.notepad.innerHTML);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.notepad.innerHTML = this.history[this.historyIndex];
            localStorage.setItem('currentNotepadContent', this.notepad.innerHTML);
        }
    }

    loadNotepadContent() {
        // Load saved content from localStorage
        const savedContent = localStorage.getItem('currentNotepadContent');
        if (savedContent) {
            this.notepad.innerHTML = savedContent;
            this.lastSavedContent = savedContent;
        }
    }
    
    setupEventListeners() {
        // Set up event listeners for all toolbar buttons
        document.querySelectorAll('.toolbar-btn').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.getAttribute('data-action');
                this.handleAction(action, button);
            });
        });
        
        // Set up font and size selectors
        const fontSelector = document.getElementById('fontSelector');
        if (fontSelector) {
            fontSelector.addEventListener('change', () => {
                document.execCommand('fontName', false, fontSelector.value);
            });
        }
        
        const fontSizeSelector = document.getElementById('fontSizeSelector');
        if (fontSizeSelector) {
            fontSizeSelector.addEventListener('change', () => {
                const fontSize = fontSizeSelector.value + 'px';
                document.execCommand('fontSize', false, '7'); 
                
                // Apply the actual font size to all font size 7 elements
                const elements = document.querySelectorAll('[size="7"]');
                elements.forEach(el => {
                    el.removeAttribute('size');
                    el.style.fontSize = fontSize;
                });
                
                // For selected content
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    if (!range.collapsed) {
                        const span = document.createElement('span');
                        span.style.fontSize = fontSize;
                        
                        // If text is selected, wrap it with the span
                        const content = range.extractContents();
                        span.appendChild(content);
                        range.insertNode(span);
                    }
                }
            });
        }
        
        // Set up color pickers
        const textColor = document.getElementById('textColor');
        if (textColor) {
            textColor.addEventListener('input', () => {
                document.execCommand('foreColor', false, textColor.value);
            });
        }
        
        const highlightColor = document.getElementById('highlightColor');
        if (highlightColor) {
            highlightColor.addEventListener('input', () => {
                document.execCommand('hiliteColor', false, highlightColor.value);
            });
        }
    }
    
    handleAction(action, button) {
        switch (action) {
            case 'new':
                if (this.notepad.innerHTML !== '' && this.notepad.innerHTML !== this.lastSavedContent) {
                    showModal({
                        title: 'Unsaved Changes',
                        message: 'You have unsaved changes. Do you want to save before creating a new note?',
                        buttons: [
                            {
                                text: 'Save',
                                primary: true,
                                callback: () => {
                                    this.askSaveLocation(() => {
                                        this.notepad.innerHTML = '';
                                        this.lastSavedContent = '';
                                    });
                                }
                            },
                            {
                                text: 'Discard',
                                callback: () => {
                                    this.notepad.innerHTML = '';
                                    this.lastSavedContent = '';
                                }
                            },
                            {
                                text: 'Cancel',
                                callback: () => {}
                            }
                        ]
                    });
                } else {
                    this.notepad.innerHTML = '';
                    this.lastSavedContent = '';
                }
                break;
                
            case 'save':
                this.saveNote();
                break;
                
            case 'download':
                this.downloadNote();
                break;
                
            case 'import':
                this.importFile();
                break;
                
            case 'print':
                this.printNotepad();
                break;
                
            case 'undo':
                this.undo();
                // Refocus the notepad after undo to maintain editing context
                this.notepad.focus();
                break;
                
            case 'redo':
                this.redo();
                // Refocus the notepad after redo to maintain editing context  
                this.notepad.focus();
                break;
                
            case 'bold':
                document.execCommand('bold');
                button.classList.toggle('active');
                break;
                
            case 'italic':
                document.execCommand('italic');
                button.classList.toggle('active');
                break;
                
            case 'underline':
                document.execCommand('underline');
                button.classList.toggle('active');
                break;
                
            case 'strikethrough':
                document.execCommand('strikethrough');
                button.classList.toggle('active');
                break;
                
            case 'justifyLeft':
                document.execCommand('justifyLeft');
                this.removeAlignActiveClass();
                button.classList.add('active');
                break;
                
            case 'justifyCenter':
                document.execCommand('justifyCenter');
                this.removeAlignActiveClass();
                button.classList.add('active');
                break;
                
            case 'justifyRight':
                document.execCommand('justifyRight');
                this.removeAlignActiveClass();
                button.classList.add('active');
                break;
                
            case 'justifyFull':
                document.execCommand('justifyFull');
                this.removeAlignActiveClass();
                button.classList.add('active');
                break;
                
            case 'insertOrderedList':
                document.execCommand('insertOrderedList');
                button.classList.toggle('active');
                break;
                
            case 'insertUnorderedList':
                document.execCommand('insertUnorderedList');
                button.classList.toggle('active');
                break;
                
            case 'emoji':
                this.showEmojiPicker();
                break;
                
            case 'link':
                this.createLink();
                break;
                
            case 'image':
                this.insertImage();
                break;
                
            case 'code':
                this.insertCode();
                break;
                
            case 'table':
                this.insertTable();
                break;
                
            case 'blockquote':
                // Create a blockquote element and insert it
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const blockquote = document.createElement('blockquote');
                    blockquote.style.borderLeft = '4px solid #6366f1';
                    blockquote.style.paddingLeft = '15px';
                    blockquote.style.margin = '15px 0';
                    blockquote.style.fontStyle = 'italic';
                    blockquote.style.color = '#4a5568';

                    // Add a click handler to exit functionality
                    blockquote.addEventListener('click', (e) => {
                        if (e.target === blockquote) {
                            const range = document.createRange();
                            range.selectNodeContents(blockquote);
                            range.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                    });

                    // If text is selected, wrap it in the blockquote
                    if (!range.collapsed) {
                        blockquote.appendChild(range.extractContents());
                        range.insertNode(blockquote);
                    } else {
                        // If no text is selected, create an empty blockquote
                        blockquote.innerHTML = '<p>Quote text here</p>';
                        range.insertNode(blockquote);
                        // Place cursor inside the blockquote
                        range.selectNodeContents(blockquote.querySelector('p'));
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                }
                break;
                
            case 'horizontalLine':
                document.execCommand('insertHorizontalRule');
                break;
                
            case 'findReplace':
                this.showFindReplaceDialog();
                break;
                
            case 'removeFormat':
                document.execCommand('removeFormat');
                break;
                
            case 'fullscreen':
                this.toggleFullscreen();
                break;
                
            case 'darkMode':
                this.toggleDarkMode();
                break;
        }
    }
    
    removeAlignActiveClass() {
        document.querySelectorAll('[data-action^="justify"]').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    
    saveNote(callback) {
        this.askSaveLocation(callback);
    }
    
    askSaveLocation(callback) {
        const content = this.notepad.innerHTML;
        
        showModal({
            title: 'Save Note',
            message: 'How would you like to save this note?',
            buttons: [
                {
                    text: 'Save as New',
                    primary: true,
                    callback: () => {
                        showModal({
                            title: 'Save as New Note',
                            message: 'Enter a title for your note:',
                            input: true,
                            inputValue: 'Untitled Note',
                            buttons: [
                                {
                                    text: 'Save',
                                    primary: true,
                                    callback: (title) => {
                                        if (title) {
                                            const noteObj = {
                                                id: Date.now(),
                                                title: title,
                                                content: content,
                                                date: new Date().toLocaleString()
                                            };
                                            
                                            let savedNotes = JSON.parse(localStorage.getItem('notes') || '[]');
                                            savedNotes.push(noteObj);
                                            localStorage.setItem('notes', JSON.stringify(savedNotes));
                                            
                                            this.lastSavedContent = content;
                                            this.loadSavedNotes();
                                            
                                            this.showToast('Note saved successfully!', 'success');
                                            
                                            if (typeof callback === 'function') {
                                                callback();
                                            }
                                        }
                                    }
                                },
                                {
                                    text: 'Cancel',
                                    callback: () => {}
                                }
                            ]
                        });
                    }
                },
                {
                    text: 'Update Current',
                    callback: () => {
                        // Check if there's an active note
                        const activeCard = document.querySelector('.saved-file-card.active');
                        if (activeCard) {
                            const noteId = parseInt(activeCard.querySelector('.file-action-btn').getAttribute('data-id'));
                            let savedNotes = JSON.parse(localStorage.getItem('notes') || '[]');
                            const noteIndex = savedNotes.findIndex(note => note.id === noteId);
                            
                            if (noteIndex !== -1) {
                                savedNotes[noteIndex].content = content;
                                savedNotes[noteIndex].date = new Date().toLocaleString();
                                localStorage.setItem('notes', JSON.stringify(savedNotes));
                                
                                this.lastSavedContent = content;
                                this.loadSavedNotes();
                                
                                this.showToast('Note updated successfully!', 'success');
                                
                                if (typeof callback === 'function') {
                                    callback();
                                }
                            }
                        } else {
                            // If no active note, fall back to save as new
                            showModal({
                                title: 'No Active Note',
                                message: 'There is no active note to update. Save as new?',
                                buttons: [
                                    {
                                        text: 'Save as New',
                                        primary: true,
                                        callback: () => {
                                            this.askSaveLocation(callback);
                                        }
                                    },
                                    {
                                        text: 'Cancel',
                                        callback: () => {}
                                    }
                                ]
                            });
                        }
                    }
                },
                {
                    text: 'Cancel',
                    callback: () => {}
                }
            ]
        });
    }
    
    loadSavedNotes() {
        const savedFilesList = document.getElementById('savedFilesList');
        const savedNotes = JSON.parse(localStorage.getItem('notes') || '[]');
        
        if (savedFilesList) {
            savedFilesList.innerHTML = '';
            
            if (savedNotes.length === 0) {
                savedFilesList.innerHTML = '<div class="empty-files-message">No saved notes yet.</div>';
                return;
            }
            
            savedNotes.forEach(note => {
                const noteCard = document.createElement('div');
                noteCard.className = 'saved-file-card';
                noteCard.innerHTML = `
                    <div class="saved-file-title">${note.title}</div>
                    <div class="saved-file-preview">${this.getPreviewText(note.content)}</div>
                    <div class="saved-file-date">${note.date}</div>
                    <div class="saved-file-actions">
                        <button class="file-action-btn" data-action="rename" data-id="${note.id}" title="Rename">
                            <i class="ri-edit-line"></i>
                        </button>
                        <button class="file-action-btn" data-action="delete" data-id="${note.id}" title="Delete">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                    </div>
                `;
                
                noteCard.addEventListener('click', (e) => {
                    if (!e.target.closest('.file-action-btn')) {
                        this.loadNote(note);
                    }
                });
                
                savedFilesList.appendChild(noteCard);
            });
            
            // Add event listeners for rename and delete buttons
            document.querySelectorAll('.file-action-btn[data-action="rename"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const noteId = parseInt(btn.getAttribute('data-id'));
                    this.renameNote(noteId);
                });
            });
            
            document.querySelectorAll('.file-action-btn[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const noteId = parseInt(btn.getAttribute('data-id'));
                    this.deleteNote(noteId);
                });
            });
        }
    }
    
    getPreviewText(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent.substring(0, 100) || 'Empty note';
    }
    
    loadNote(note) {
        if (this.notepad.innerHTML !== this.lastSavedContent) {
            showModal({
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. Load this note anyway?',
                buttons: [
                    {
                        text: 'Load',
                        primary: true,
                        callback: () => {
                            this.notepad.innerHTML = note.content;
                            this.lastSavedContent = note.content;
                            
                            document.querySelectorAll('.saved-file-card').forEach(card => {
                                card.classList.remove('active');
                                if (parseInt(card.querySelector('.file-action-btn').getAttribute('data-id')) === note.id) {
                                    card.classList.add('active');
                                }
                            });
                        }
                    },
                    {
                        text: 'Cancel',
                        callback: () => {}
                    }
                ]
            });
            return;
        }
        
        this.notepad.innerHTML = note.content;
        this.lastSavedContent = note.content;
        
        document.querySelectorAll('.saved-file-card').forEach(card => {
            card.classList.remove('active');
            if (parseInt(card.querySelector('.file-action-btn').getAttribute('data-id')) === note.id) {
                card.classList.add('active');
            }
        });
    }
    
    renameNote(noteId) {
        const savedNotes = JSON.parse(localStorage.getItem('notes') || '[]');
        const noteIndex = savedNotes.findIndex(note => note.id === noteId);
        
        if (noteIndex !== -1) {
            showModal({
                title: 'Rename Note',
                message: 'Enter a new title:',
                input: true,
                inputValue: savedNotes[noteIndex].title,
                buttons: [
                    {
                        text: 'Rename',
                        primary: true,
                        callback: (newTitle) => {
                            if (newTitle) {
                                savedNotes[noteIndex].title = newTitle;
                                localStorage.setItem('notes', JSON.stringify(savedNotes));
                                this.loadSavedNotes();
                            }
                        }
                    },
                    {
                        text: 'Cancel',
                        callback: () => {}
                    }
                ]
            });
        }
    }
    
    deleteNote(noteId) {
        showModal({
            title: 'Delete Note',
            message: 'Are you sure you want to delete this note?',
            buttons: [
                {
                    text: 'Delete',
                    primary: true,
                    callback: () => {
                        let savedNotes = JSON.parse(localStorage.getItem('notes') || '[]');
                        savedNotes = savedNotes.filter(note => note.id !== noteId);
                        localStorage.setItem('notes', JSON.stringify(savedNotes));
                        this.loadSavedNotes();
                    }
                },
                {
                    text: 'Cancel',
                    callback: () => {}
                }
            ]
        });
    }
    
    downloadNote() {
        showModal({
            title: 'Export Note',
            message: 'Choose a format to export your note:',
            content: () => {
                const container = document.createElement('div');
                
                const formatOptions = document.createElement('div');
                formatOptions.className = 'format-options';
                
                const formats = [
                    { icon: 'ri-file-text-line', name: 'Text (.txt)' },
                    { icon: 'ri-html5-line', name: 'HTML (.html)' },
                    { icon: 'ri-markdown-line', name: 'Markdown (.md)' },
                    { icon: 'ri-file-word-line', name: 'Word (.docx)' },
                    { icon: 'ri-file-pdf-line', name: 'PDF (.pdf)' }
                ];
                
                formats.forEach(format => {
                    const option = document.createElement('div');
                    option.className = 'format-option';
                    option.innerHTML = `<i class="${format.icon}"></i><span>${format.name}</span>`;
                    option.addEventListener('click', () => {
                        this.exportAs(format.name.split('(')[1].replace(')', '').trim());
                        document.querySelector('.modal-backdrop').remove();
                    });
                    formatOptions.appendChild(option);
                });
                
                container.appendChild(formatOptions);
                return container;
            },
            buttons: [
                {
                    text: 'Cancel',
                    callback: () => {}
                }
            ]
        });
    }
    
    exportAs(format) {
        const content = this.notepad.innerHTML;
        const textContent = this.notepad.innerText;
        
        switch(format) {
            case '.txt':
                // Preserve line breaks and spacing in text export
                const preservedTextContent = this.notepad.innerText.replace(/\n/g, '\r\n');
                this.downloadFile(preservedTextContent, 'note.txt', 'text/plain');
                break;
            case '.html':
                const htmlContent = `<!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Exported Note</title>
                </head>
                <body>
                    ${content}
                </body>
                </html>`;
                this.downloadFile(htmlContent, 'note.html', 'text/html');
                break;
            case '.md':
                // Simple HTML to Markdown conversion
                let markdown = textContent;
                this.downloadFile(markdown, 'note.md', 'text/markdown');
                break;
            case '.docx':
                this.exportToDocx();
                break;
            case '.pdf':
                this.exportToPdf();
                break;
        }
    }
    
    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast(`Note exported as ${filename}`, 'success');
    }
    
    exportToDocx() {
        // Show loading toast
        this.showToast('Generating DOCX...', 'info');

        try {
            // Use the docx library to properly create a docx file
            const { Document, Paragraph, TextRun, Packer, HeadingLevel } = window.docx;

            // Extract text content with basic formatting
            const content = this.notepad.innerHTML;
            const div = document.createElement('div');
            div.innerHTML = content;

            // Convert HTML to docx paragraphs
            const paragraphs = [];
            
            // Process each node to preserve structure
            const processNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.textContent.trim()) {
                        return [new TextRun(node.textContent)];
                    }
                    return [];
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const runs = [];
                    
                    // Process element based on tag type
                    if (node.tagName === 'BR') {
                        // Return a paragraph break
                        return 'paragraph-break';
                    } 
                    else if (node.tagName === 'P' || node.tagName === 'DIV' || 
                             node.tagName === 'H1' || node.tagName === 'H2' || 
                             node.tagName === 'H3' || node.tagName === 'H4' || 
                             node.tagName === 'H5' || node.tagName === 'H6' || 
                             node.tagName === 'LI') {
                        // Process block elements
                        let childRuns = [];
                        for (const childNode of node.childNodes) {
                            const result = processNode(childNode);
                            if (result === 'paragraph-break') {
                                // Add what we have as a paragraph and start a new one
                                if (childRuns.length > 0) {
                                    paragraphs.push(new Paragraph({ children: childRuns }));
                                    childRuns = [];
                                }
                            } else if (Array.isArray(result)) {
                                childRuns = childRuns.concat(result);
                            }
                        }
                        
                        // Add the paragraph if it has content, with proper heading level if applicable
                        if (childRuns.length > 0) {
                            let heading = null;
                            switch (node.tagName) {
                                case 'H1': heading = HeadingLevel.HEADING_1; break;
                                case 'H2': heading = HeadingLevel.HEADING_2; break;
                                case 'H3': heading = HeadingLevel.HEADING_3; break;
                                case 'H4': heading = HeadingLevel.HEADING_4; break;
                                case 'H5': heading = HeadingLevel.HEADING_5; break;
                                case 'H6': heading = HeadingLevel.HEADING_6; break;
                                default: heading = null;
                            }
                            
                            paragraphs.push(new Paragraph({ 
                                children: childRuns,
                                heading: heading,
                                spacing: heading ? { before: 240, after: 120 } : undefined
                            }));
                        }
                        
                        // Add an empty paragraph after block elements for spacing
                        if (node.tagName !== 'SPAN' && node.tagName !== 'A') {
                            paragraphs.push(new Paragraph({}));
                        }
                        
                        return 'block-processed';
                    } else {
                        // Process inline elements and apply formatting
                        for (const childNode of node.childNodes) {
                            const result = processNode(childNode);
                            if (Array.isArray(result)) {
                                result.forEach(run => {
                                    // Apply formatting based on parent element
                                    if (node.tagName === 'B' || node.tagName === 'STRONG') {
                                        run.bold = true;
                                    }
                                    if (node.tagName === 'I' || node.tagName === 'EM') {
                                        run.italic = true;
                                    }
                                    if (node.tagName === 'U') {
                                        run.underline = true;
                                    }
                                    if (node.tagName === 'STRIKE' || node.tagName === 'S') {
                                        run.strike = true;
                                    }
                                    
                                    runs.push(run);
                                });
                            }
                        }
                        return runs;
                    }
                }
                
                return [];
            };
            
            // Start processing from root nodes
            for (const node of div.childNodes) {
                const result = processNode(node);
                // Only add a new paragraph if it wasn't already processed as a block
                if (result !== 'block-processed' && Array.isArray(result) && result.length > 0) {
                    paragraphs.push(new Paragraph({ children: result }));
                }
            }
            
            // If we ended up with no paragraphs, create one with the plain text
            if (paragraphs.length === 0) {
                const plainText = div.textContent.trim();
                if (plainText) {
                    // Split by line breaks and create paragraphs
                    plainText.split('\n').forEach(line => {
                        paragraphs.push(new Paragraph({
                            children: [new TextRun(line)]
                        }));
                    });
                }
            }

            // Create document with standard margins 
            const doc = new Document({
                sections: [{
                    properties: {
                        margin: {
                            top: 1440, // 1 inch
                            right: 1440,
                            bottom: 1440,
                            left: 1440
                        }
                    },
                    children: paragraphs
                }]
            });

            // Generate the docx file
            Packer.toBlob(doc).then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'note.docx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast('DOCX exported successfully!', 'success');
            });
        } catch (error) {
            console.error("Error generating DOCX:", error);
            
            // Fallback to text export  
            this.showToast('Advanced DOCX export failed. Exporting as text.', 'warning');
            const textContent = this.notepad.innerText;
            this.downloadFile(textContent, 'note.txt', 'text/plain');
        }
    }
    
    importFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.html,.md,.rtf,.docx,.pdf,.doc,.odt,.pages';
        
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            
            this.showToast(`Importing ${file.name}...`, 'info');
            
            const reader = new FileReader();
            reader.onload = e => {
                if (this.notepad.innerHTML !== this.lastSavedContent) {
                    showModal({
                        title: 'Unsaved Changes',
                        message: 'You have unsaved changes. Import this file anyway?',
                        buttons: [
                            {
                                text: 'Import',
                                primary: true,
                                callback: () => {
                                    // Continue with import process
                                    const extension = file.name.split('.').pop().toLowerCase();
                                    this.processImportedFile(file, e.target.result, extension);
                                }
                            },
                            {
                                text: 'Cancel',
                                callback: () => {}
                            }
                        ]
                    });
                    return;
                }
                
                const extension = file.name.split('.').pop().toLowerCase();
                this.processImportedFile(file, e.target.result, extension);
            };
            
            reader.onerror = () => {
                this.showToast('Error reading file. File may be corrupted.', 'error');
            };
            
            // Use the appropriate read method based on file type
            const extension = file.name.split('.').pop().toLowerCase();
            if (['rtf', 'docx', 'doc', 'pdf', 'odt', 'pages'].includes(extension)) {
                reader.readAsArrayBuffer(file); // For binary formats
            } else {
                reader.readAsText(file);
            }
        };
        
        input.click();
    }
    
    processImportedFile(file, content, extension) {
        try {
            // Handle different file types appropriately
            if (extension === 'txt') {
                // Convert plain text to HTML with proper line breaks
                const textContent = content;
                const htmlContent = textContent.replace(/\n/g, '<br>');
                this.notepad.innerHTML = htmlContent;
                this.showToast('Text file imported successfully', 'success');
            } else if (extension === 'html' || extension === 'htm') {
                // Sanitize HTML content
                const htmlContent = content;
                const cleanHtml = this.sanitizeHtml(htmlContent);
                this.notepad.innerHTML = cleanHtml;
                this.showToast('HTML file imported successfully', 'success');
            } else if (extension === 'md') {
                // Convert markdown to HTML
                const markdownContent = content;
                const htmlContent = this.convertMarkdownToHtml(markdownContent);
                this.notepad.innerHTML = htmlContent;
                this.showToast('Markdown file imported successfully', 'success');
            } else if (extension === 'rtf') {
                // Better RTF handling
                this.showToast('Processing RTF file...', 'info');
                this.importRtfContent(content);
            } else if (['docx', 'doc', 'odt', 'pages'].includes(extension)) {
                this.showToast(`Importing ${extension.toUpperCase()} file...`, 'info');
                this.importOfficeDocument(file);
            } else if (extension === 'pdf') {
                this.showToast('Processing PDF file...', 'info');
                this.importPdfDocument(file);
            } else {
                // Default fallback - attempt as plain text
                this.showToast('Unknown file format. Importing as plain text', 'warning');
                const plainText = content.toString().replace(/[^\r\n\t\x20-\x7E]/g, '');
                this.notepad.innerHTML = plainText.replace(/\n/g, '<br>');
            }
        } catch (error) {
            console.error("Import error:", error);
            this.showToast('Error importing file. Trying alternative method...', 'warning');
            // Fallback to basic text import
            try {
                const safeText = content.replace(/[^\r\n\t\x20-\x7E]/g, '');
                this.notepad.innerHTML = safeText.replace(/\n/g, '<br>');
                this.showToast('Imported file as plain text', 'warning');
            } catch (e) {
                this.showToast('Could not import file. Format may be unsupported.', 'error');
            }
        }
    }
    
    sanitizeHtml(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove potentially harmful elements and attributes
        const scripts = tempDiv.querySelectorAll('script, iframe, object, embed');
        scripts.forEach(el => el.remove());
        
        // Remove on* attributes
        const allElements = tempDiv.querySelectorAll('*');
        allElements.forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on') || attr.name === 'href' && attr.value.startsWith('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        
        return tempDiv.innerHTML;
    }
    
    importRtfContent(rtfData) {
        try {
            // Basic RTF to HTML conversion
            let text = rtfData;
            if (typeof rtfData !== 'string') {
                // Convert ArrayBuffer to string
                const decoder = new TextDecoder('utf-8');
                text = decoder.decode(rtfData);
            }
            
            // Process RTF content
            // Remove RTF headers and control sequences
            text = text.replace(/\\rtf1.*?\\viewkind0/s, '');
            text = text.replace(/\{\\*\\.*?\}/g, '');
            text = text.replace(/\\[a-z0-9]+\s?/g, '');
            
            // Convert RTF newlines and paragraphs to HTML
            text = text.replace(/\\par\s/g, '<br>');
            text = text.replace(/\\line\s/g, '<br>');
            
            // Handle special characters
            text = text.replace(/\\'([0-9a-f]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
            
            // Remove remaining RTF syntax
            text = text.replace(/[\{\}\\]/g, '');
            
            // Clean up multiple line breaks
            text = text.replace(/<br><br><br>/g, '<br><br>');
            
            this.notepad.innerHTML = text;
            this.showToast('RTF file imported', 'success');
        } catch (e) {
            console.error("RTF import error:", e);
            this.showToast('Error processing RTF. Importing as plain text.', 'warning');
            
            // Fallback to plain text
            const plainText = rtfData.toString().replace(/[^\r\n\t\x20-\x7E]/g, '');
            this.notepad.innerHTML = plainText.replace(/\n/g, '<br>');
        }
    }
    
    importOfficeDocument(file) {
        // Enhanced implementation for Office documents
        try {
            // Show loading toast
            this.showToast(`Importing ${file.name.split('.').pop().toUpperCase()} file...`, 'info');
            
            // Create a FileReader to read the file
            const reader = new FileReader();
            reader.onload = (e) => {
                const arrayBuffer = e.target.result;
                
                // Use a more robust approach to extract content from DOCX
                try {
                    // For DOCX files, we'll use a better extraction method
                    // First attempt: Try to extract structured content
                    this.extractOfficeContent(arrayBuffer, file.name)
                        .then(content => {
                            // Apply the content to the notepad
                            this.notepad.innerHTML = content;
                            this.showToast(`${file.name.split('.').pop().toUpperCase()} file imported successfully`, 'success');
                        })
                        .catch(error => {
                            console.error("Extraction error:", error);
                            // Fallback method
                            this.fallbackTextExtraction(arrayBuffer, file.name);
                        });
                } catch (error) {
                    console.error("DOCX processing error:", error);
                    this.fallbackTextExtraction(arrayBuffer, file.name);
                }
            };
            
            reader.onerror = () => {
                this.showToast('Error reading file. The file may be corrupted.', 'error');
            };
            
            reader.readAsArrayBuffer(file);
        } catch (e) {
            console.error("Office document import error:", e);
            this.showToast('Error processing document. Importing as plain text.', 'warning');
            
            // Ultimate fallback to plain text
            const textReader = new FileReader();
            textReader.onload = e => {
                const plainText = e.target.result.replace(/[^\r\n\t\x20-\x7E]/g, '');
                this.notepad.innerHTML = plainText.replace(/\n/g, '<br>');
            };
            textReader.readAsText(file);
        }
    }
    
    extractOfficeContent(arrayBuffer, fileName) {
        return new Promise((resolve, reject) => {
            // Better content extraction logic
            const extension = fileName.split('.').pop().toLowerCase();
            
            if (extension === 'docx') {
                // Parse DOCX by looking for readable text content in XML
                // DOCX files are ZIP archives containing XML files
                try {
                    // Simple extraction of readable text from DOCX buffer
                    const array = new Uint8Array(arrayBuffer);
                    let textContent = '';
                    
                    // Look for document.xml content - a common approach for simple DOCX extraction
                    const documentXmlSignature = 'word/document.xml';
                    const utf8Encoder = new TextEncoder();
                    const signatureBytes = utf8Encoder.encode(documentXmlSignature);
                    
                    // Try to find the document.xml file within the DOCX (ZIP) structure
                    for (let i = 0; i < array.length - signatureBytes.length; i++) {
                        let found = true;
                        for (let j = 0; j < signatureBytes.length; j++) {
                            if (array[i + j] !== signatureBytes[j]) {
                                found = false;
                                break;
                            }
                        }
                        
                        if (found) {
                            // We found a document.xml reference, now look for actual content
                            // Usually <w:t> tags contain the actual text content
                            const contentStart = i + 200; // Skip ahead to likely content area
                            let contentFragment = '';
                            
                            // Extract and decode text in chunks
                            for (let k = contentStart; k < Math.min(contentStart + 100000, array.length); k++) {
                                // Only include readable ASCII characters
                                if (array[k] >= 32 && array[k] <= 126) { 
                                    contentFragment += String.fromCharCode(array[k]);
                                }
                            }
                            
                            // Try to extract paragraphs from XML-like content
                            const paragraphs = contentFragment.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
                            
                            if (paragraphs.length > 0) {
                                // Process XML paragraph tags
                                const parsedContent = paragraphs
                                    .map(p => p.replace(/<[^>]+>/g, '')) // Remove XML tags
                                    .join(' ')
                                    .replace(/\s+/g, ' '); // Normalize whitespace
                                
                                // Add paragraph structure
                                textContent += parsedContent.split('. ')
                                    .map(sentence => sentence.trim())
                                    .filter(sentence => sentence.length > 0)
                                    .map(sentence => `<p>${sentence}${!sentence.endsWith('.') ? '.' : ''}</p>`)
                                    .join('');
                            }
                            
                            break;
                        }
                    }
                    
                    if (textContent.length > 0) {
                        resolve(textContent);
                    } else {
                        // No structured content found, try fallback
                        reject(new Error("No structured content found"));
                    }
                } catch (error) {
                    reject(error);
                }
            } else {
                // For other formats, use more generic approach
                reject(new Error("Unsupported format for structured extraction"));
            }
        });
    }
    
    fallbackTextExtraction(arrayBuffer, fileName) {
        try {
            // Fallback extraction method for when structured parsing fails
            this.showToast('Using alternative extraction method...', 'info');
            
            const array = new Uint8Array(arrayBuffer);
            const chunks = [];
            let currentChunk = '';
            let inTextBlock = false;
            let readableCount = 0;
            
            // Look for contiguous blocks of text (at least 3 readable chars in a row)
            for (let i = 0; i < array.length; i++) {
                const byte = array[i];
                
                // Is this a readable ASCII character?
                if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13) {
                    if (byte >= 32 && byte <= 126) {
                        readableCount++;
                    }
                    
                    // Convert byte to character
                    const char = String.fromCharCode(byte);
                    
                    // Check if we're in a text block
                    if (readableCount >= 3) {
                        if (!inTextBlock) {
                            inTextBlock = true;
                        }
                        currentChunk += char;
                    } else if (inTextBlock) {
                        // Add spacing or line breaks
                        if (byte === 10 || byte === 13) {
                            currentChunk += '\n';
                        } else {
                            currentChunk += char;
                        }
                    }
                } else {
                    // Non-readable character
                    readableCount = 0;
                    
                    // If we were in a text block, end it
                    if (inTextBlock) {
                        if (currentChunk.length >= 10) { // Only keep substantial chunks
                            chunks.push(currentChunk);
                        }
                        currentChunk = '';
                        inTextBlock = false;
                    }
                }
            }
            
            // Add the last chunk if it exists
            if (currentChunk.length >= 10) {
                chunks.push(currentChunk);
            }
            
            // Process the chunks into a coherent document
            let content = chunks
                .join('\n\n')
                .replace(/[^\x20-\x7E\n]/g, '') // Remove any binary artifacts
                .replace(/\n{3,}/g, '\n\n'); // Normalize excessive line breaks
            
            // Convert to paragraphs
            const paragraphs = content.split('\n\n');
            const htmlContent = paragraphs
                .filter(p => p.trim().length > 0)
                .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                .join('');
            
            // Update the notepad with our best effort conversion
            this.notepad.innerHTML = htmlContent;
            this.showToast('File imported with basic formatting', 'info');
        } catch (e) {
            console.error("Fallback extraction failed:", e);
            this.notepad.innerHTML = '<p>Could not extract meaningful content from this file. Please try copying the text directly.</p>';
            this.showToast('File extraction failed', 'error');
        }
    }
    
    convertMarkdownToHtml(markdown) {
        // Enhanced markdown conversion
        let html = markdown;
        // Headers
        html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
        html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
        html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
        html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
        html = html.replace(/^##### (.*?)$/gm, '<h5>$1</h5>');
        html = html.replace(/^###### (.*?)$/gm, '<h6>$1</h6>');
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        html = html.replace(/__(.*?)__/g, '<b>$1</b>');
        // Italic
        html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
        html = html.replace(/_(.*?)_/g, '<i>$1</i>');
        // Strikethrough
        html = html.replace(/~~(.*?)~~/g, '<strike>$1</strike>');
        // Blockquote
        html = html.replace(/^> (.*?)$/gm, '<blockquote>$1</blockquote>');
        // Code blocks
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Lists
        // Unordered lists
        html = html.replace(/^\* (.*?)$/gm, '<ul><li>$1</li></ul>');
        html = html.replace(/^- (.*?)$/gm, '<ul><li>$1</li></ul>');
        // Ordered lists
        html = html.replace(/^\d+\. (.*?)$/gm, '<ol><li>$1</li></ol>');
        // Links
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
        // Images
        html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');
        // Line breaks
        html = html.replace(/\n/g, '<br>');
        // Fix duplicate list tags
        html = html.replace(/<\/ul><ul>/g, '');
        html = html.replace(/<\/ol><ol>/g, '');
        
        return html;
    }
    
    createLink() {
        showModal({
            title: 'Insert Link',
            message: 'Enter the URL:',
            input: true,
            inputValue: 'https://',
            buttons: [
                {
                    text: 'Insert',
                    primary: true,
                    callback: (url) => {
                        if (url) {
                            document.execCommand('createLink', false, url);
                        }
                    }
                },
                {
                    text: 'Cancel',
                    callback: () => {}
                }
            ]
        });
    }
    
    insertImage() {
        showModal({
            title: 'Insert Image',
            message: 'Enter the image URL or upload from your device:',
            content: () => {
                const container = document.createElement('div');
                
                // URL input group
                const urlGroup = document.createElement('div');
                urlGroup.className = 'form-group';
                urlGroup.style.marginBottom = '20px';
                
                const urlLabel = document.createElement('label');
                urlLabel.textContent = 'Image URL:';
                urlLabel.style.display = 'block';
                urlLabel.style.marginBottom = '5px';
                
                const urlInput = document.createElement('input');
                urlInput.type = 'text';
                urlInput.value = 'https://';
                urlInput.className = 'modal-input';
                
                urlGroup.appendChild(urlLabel);
                urlGroup.appendChild(urlInput);
                
                // Upload input group
                const uploadGroup = document.createElement('div');
                uploadGroup.className = 'form-group';
                
                const uploadLabel = document.createElement('label');
                uploadLabel.textContent = 'Or upload from your device:';
                uploadLabel.style.display = 'block';
                uploadLabel.style.marginTop = '15px';
                uploadLabel.style.marginBottom = '5px';
                
                const uploadInput = document.createElement('input');
                uploadInput.type = 'file';
                uploadInput.accept = 'image/*';
                uploadInput.className = 'modal-input';
                
                uploadGroup.appendChild(uploadLabel);
                uploadGroup.appendChild(uploadInput);
                
                container.appendChild(urlGroup);
                container.appendChild(uploadGroup);
                
                return container;
            },
            buttons: [
                {
                    text: 'Insert',
                    primary: true,
                    callback: () => {
                        const urlInput = document.querySelector('.modal-container input[type="text"]');
                        const fileInput = document.querySelector('.modal-container input[type="file"]');
                        
                        if (fileInput && fileInput.files && fileInput.files[0]) {
                            // Handle file upload
                            const file = fileInput.files[0];
                            if (file.type.startsWith('image/')) {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    const selection = window.getSelection();
                                    const range = selection.getRangeAt(0);
                                    const img = document.createElement('img');
                                    img.src = e.target.result;
                                    img.style.maxWidth = '100%';
                                    range.deleteContents();
                                    range.insertNode(img);
                                    
                                    // Move cursor after inserted image
                                    range.setStartAfter(img);
                                    range.collapse(true);
                                    selection.removeAllRanges();
                                    selection.addRange(range);
                                    
                                    // Make sure notepad gets focus
                                    this.notepad.focus();
                                };
                                reader.readAsDataURL(file);
                                this.showToast('Image inserted successfully', 'success');
                            } else {
                                this.showToast('Please select a valid image file', 'error');
                            }
                        } else if (urlInput && urlInput.value && urlInput.value !== 'https://') {
                            // Handle URL
                            const selection = window.getSelection();
                            const range = selection.getRangeAt(0);
                            const img = document.createElement('img');
                            img.src = urlInput.value;
                            img.style.maxWidth = '100%';
                            range.deleteContents();
                            range.insertNode(img);
                            
                            // Move cursor after image
                            range.setStartAfter(img);
                            range.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(range);
                            
                            this.showToast('Image inserted successfully', 'success');
                        } else {
                            this.showToast('Please provide an image URL or select a file', 'warning');
                        }
                    }
                },
                {
                    text: 'Cancel',
                    callback: () => {}
                }
            ]
        });
    }
    
    insertCode() {
        showModal({
            title: 'Insert Code',
            message: 'Enter your code:',
            input: true,
            inputValue: '',
            buttons: [
                {
                    text: 'Insert',
                    primary: true,
                    callback: (code) => {
                        if (code) {
                            const pre = document.createElement('pre');
                            const codeElement = document.createElement('code');
                            codeElement.textContent = code;
                            pre.appendChild(codeElement);
                            
                            const selection = window.getSelection();
                            const range = selection.getRangeAt(0);
                            range.deleteContents();
                            range.insertNode(pre);
                        }
                    }
                },
                {
                    text: 'Cancel',
                    callback: () => {}
                }
            ]
        });
    }
    
    insertTable() {
        let rowsInput, colsInput;
        
        const modal = showModal({
            title: 'Insert Table',
            message: 'Configure your table:',
            content: () => {
                const container = document.createElement('div');
                
                const rowsLabel = document.createElement('label');
                rowsLabel.textContent = 'Number of rows:';
                rowsLabel.style.display = 'block';
                rowsLabel.style.marginBottom = '5px';
                
                rowsInput = document.createElement('input');
                rowsInput.type = 'number';
                rowsInput.min = '1';
                rowsInput.value = '3';
                rowsInput.className = 'modal-input';
                
                const colsLabel = document.createElement('label');
                colsLabel.textContent = 'Number of columns:';
                colsLabel.style.display = 'block';
                colsLabel.style.marginTop = '15px';
                colsLabel.style.marginBottom = '5px';
                
                colsInput = document.createElement('input');
                colsInput.type = 'number';
                colsInput.min = '1';
                colsInput.value = '3';
                colsInput.className = 'modal-input';
                
                container.appendChild(rowsLabel);
                container.appendChild(rowsInput);
                container.appendChild(colsLabel);
                container.appendChild(colsInput);
                
                return container;
            },
            buttons: [
                {
                    text: 'Insert',
                    primary: true,
                    callback: () => {
                        const rows = parseInt(rowsInput.value) || 3;
                        const cols = parseInt(colsInput.value) || 3;
                        
                        let tableHTML = '<table border="1" style="width:100%">';
                        
                        // Create header row
                        tableHTML += '<tr>';
                        for (let i = 0; i < cols; i++) {
                            tableHTML += '<th>Header ' + (i + 1) + '</th>';
                        }
                        tableHTML += '</tr>';
                        
                        // Create data rows
                        for (let i = 0; i < rows - 1; i++) {
                            tableHTML += '<tr>';
                            for (let j = 0; j < cols; j++) {
                                tableHTML += '<td>Cell ' + (i + 1) + ',' + (j + 1) + '</td>';
                            }
                            tableHTML += '</tr>';
                        }
                        
                        tableHTML += '</table>';
                        
                        document.execCommand('insertHTML', false, tableHTML);
                    }
                },
                {
                    text: 'Cancel',
                    callback: () => {}
                }
            ]
        });
        
        // Custom content handling for the table modal
        if (typeof modal.setContent === 'function') {
            const content = document.createElement('div');
            
            const rowsLabel = document.createElement('label');
            rowsLabel.textContent = 'Number of rows:';
            rowsLabel.style.display = 'block';
            rowsLabel.style.marginBottom = '5px';
            
            rowsInput = document.createElement('input');
            rowsInput.type = 'number';
            rowsInput.min = '1';
            rowsInput.value = '3';
            rowsInput.className = 'modal-input';
            
            const colsLabel = document.createElement('label');
            colsLabel.textContent = 'Number of columns:';
            colsLabel.style.display = 'block';
            colsLabel.style.marginTop = '15px';
            colsLabel.style.marginBottom = '5px';
            
            colsInput = document.createElement('input');
            colsInput.type = 'number';
            colsInput.min = '1';
            colsInput.value = '3';
            colsInput.className = 'modal-input';
            
            content.appendChild(rowsLabel);
            content.appendChild(rowsInput);
            content.appendChild(colsLabel);
            content.appendChild(colsInput);
            
            modal.setContent(content);
        }
    }
    
    showFindReplaceDialog() {
        let findInput, replaceInput;
        
        const modal = showModal({
            title: 'Find and Replace',
            message: '',
            content: () => {
                const container = document.createElement('div');
                
                const findLabel = document.createElement('label');
                findLabel.textContent = 'Find:';
                findLabel.style.display = 'block';
                findLabel.style.marginBottom = '5px';
                
                findInput = document.createElement('input');
                findInput.type = 'text';
                findInput.className = 'modal-input';
                
                const replaceLabel = document.createElement('label');
                replaceLabel.textContent = 'Replace with:';
                replaceLabel.style.display = 'block';
                replaceLabel.style.marginTop = '15px';
                replaceLabel.style.marginBottom = '5px';
                
                replaceInput = document.createElement('input');
                replaceInput.type = 'text';
                replaceInput.className = 'modal-input';
                
                container.appendChild(findLabel);
                container.appendChild(findInput);
                container.appendChild(replaceLabel);
                container.appendChild(replaceInput);
                
                return container;
            },
            buttons: [
                {
                    text: 'Replace All',
                    primary: true,
                    callback: () => {
                        const findText = findInput.value;
                        const replaceText = replaceInput.value;
                        
                        if (findText) {
                            const content = this.notepad.innerHTML;
                            const newContent = content.replace(new RegExp(findText, 'g'), replaceText);
                            this.notepad.innerHTML = newContent;
                        }
                    }
                },
                {
                    text: 'Cancel',
                    callback: () => {}
                }
            ]
        });
        
        // Custom content handling for the find/replace modal
        if (typeof modal.setContent === 'function') {
            const content = document.createElement('div');
            
            const findLabel = document.createElement('label');
            findLabel.textContent = 'Find:';
            findLabel.style.display = 'block';
            findLabel.style.marginBottom = '5px';
            
            findInput = document.createElement('input');
            findInput.type = 'text';
            findInput.className = 'modal-input';
            
            const replaceLabel = document.createElement('label');
            replaceLabel.textContent = 'Replace with:';
            replaceLabel.style.display = 'block';
            replaceLabel.style.marginTop = '15px';
            replaceLabel.style.marginBottom = '5px';
            
            replaceInput = document.createElement('input');
            replaceInput.type = 'text';
            replaceInput.className = 'modal-input';
            
            content.appendChild(findLabel);
            content.appendChild(findInput);
            content.appendChild(replaceLabel);
            content.appendChild(replaceInput);
            
            modal.setContent(content);
        }
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const toastContent = document.createElement('div');
        toastContent.className = 'toast-content';
        
        const icon = document.createElement('i');
        if (type === 'success') {
            icon.className = 'ri-check-line';
        } else if (type === 'error') {
            icon.className = 'ri-error-warning-line';
        } else if (type === 'warning') {
            icon.className = 'ri-alert-line';
        } else {
            icon.className = 'ri-information-line';
        }
        
        const text = document.createElement('span');
        text.textContent = message;
        
        toastContent.appendChild(icon);
        toastContent.appendChild(text);
        
        const progress = document.createElement('div');
        progress.className = 'toast-progress';
        
        toast.appendChild(toastContent);
        toast.appendChild(progress);
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
    
    showEmojiPicker() {
        const backdrop = document.createElement('div');
        backdrop.className = 'emoji-backdrop';
        
        const emojiModal = document.createElement('div');
        emojiModal.className = 'emoji-modal';
        
        // Create modal header
        const header = document.createElement('div');
        header.className = 'emoji-modal-header';
        header.innerHTML = `
            <h3>Emojis & Special Characters</h3>
            <button class="emoji-close-btn">&times;</button>
        `;
        
        // Create tabs
        const tabs = document.createElement('div');
        tabs.className = 'emoji-tabs';
        
        const emojiCategories = [
            { id: 'smileys', name: 'Smileys & Emotion' },
            { id: 'people', name: 'People & Body' },
            { id: 'animals', name: 'Animals & Nature' },
            { id: 'food', name: 'Food & Drink' },
            { id: 'travel', name: 'Travel & Places' },
            { id: 'activities', name: 'Activities' },
            { id: 'objects', name: 'Objects' },
            { id: 'symbols', name: 'Symbols' },
            { id: 'flags', name: 'Flags' },
            { id: 'special', name: 'Special Characters' }
        ];
        
        emojiCategories.forEach((category, index) => {
            const tab = document.createElement('div');
            tab.className = `emoji-tab${index === 0 ? ' active' : ''}`;
            tab.setAttribute('data-category', category.id);
            tab.textContent = category.name;
            tabs.appendChild(tab);
        });
        
        // Create emoji grid container
        const emojiGridContainer = document.createElement('div');
        emojiGridContainer.className = 'emoji-grid-container';
        
        // Add smileys by default
        const smileyEmojis = [
            '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', 
            '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', 
            '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', 
            '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', 
            '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', 
            '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', 
            '🤗', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬'
        ];
        
        const grid = document.createElement('div');
        grid.className = 'emoji-grid';
        
        smileyEmojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji;
            emojiItem.addEventListener('click', () => {
                this.insertAtCursor(emoji);
                backdrop.remove();
            });
            grid.appendChild(emojiItem);
        });
        
        emojiGridContainer.appendChild(grid);
        
        // Assemble the modal
        emojiModal.appendChild(header);
        emojiModal.appendChild(tabs);
        emojiModal.appendChild(emojiGridContainer);
        backdrop.appendChild(emojiModal);
        
        // Close button functionality
        const closeBtn = emojiModal.querySelector('.emoji-close-btn');
        closeBtn.addEventListener('click', () => {
            backdrop.remove();
        });
        
        // Tab switching functionality
        const tabElements = emojiModal.querySelectorAll('.emoji-tab');
        tabElements.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab
                tabElements.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update emoji grid based on category
                const category = tab.getAttribute('data-category');
                this.updateEmojiGrid(emojiGridContainer, category);
            });
        });
        
        document.body.appendChild(backdrop);
    }
    
    insertAtCursor(text) {
        // Focus the notepad first
        this.notepad.focus();

        // Use execCommand to insert at current cursor position
        document.execCommand('insertText', false, text);

        // If execCommand isn't supported or doesn't work, fall back to this method:
        if (typeof window.getSelection !== 'undefined') {
            const sel = window.getSelection();
            if (sel.getRangeAt && sel.rangeCount) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                
                // Move cursor to the end of the inserted text
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }
    
    updateEmojiGrid(container, category) {
        const grid = container.querySelector('.emoji-grid') || document.createElement('div');
        grid.className = 'emoji-grid';
        grid.innerHTML = '';
        
        let emojis = [];
        
        // Provide emojis by category
        switch(category) {
            case 'smileys':
                emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬'];
                break;
            case 'people':
                emojis = ['👋', '🤚', '✋', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪'];
                break;
            case 'animals':
                emojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣'];
                break;
            case 'food':
                emojis = ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️'];
                break;
            case 'travel':
                emojis = ['🚗', '🚕', '🚙', '🚌', '🚎', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛵', '🚲', '✈️', '🚀', '🚁', '⛵', '🚤', '🛳️', '🚢', '⚓', '⛽', '🚦', '🚥', '📢', '📣', '📯', '🔔', '🔕', '🎡', '🎢', '🎠', '⛲', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏕️', '⛺', '🏠', '🏡', '🏢', '🏭', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '⛪', '🕌', '🕍', '⛩️'];
                break;
            case 'activities':
                emojis = ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🏒', '🏑', '🏏', '⛳', '🎣', '🥊', '🥋', '🎽', '🛹', '🎿', '🏂', '🏋️', '⛹️', '🤺', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻'];
                break;
            case 'objects':
                emojis = ['🎭', '👓', '🕶️', '👔', '👕', '👖', '🧣', '🧤', '🧥', '🧦', '👗', '👘', '👙', '👚', '👛', '👜', '👝', '🛍️', '🎒', '👞', '👟', '👠', '👡', '👢', '👑', '👒', '🎩', '📚', '📖', '📰', '📢', '📣', '📯', '🔔', '🔕', '🎼', '🎵', '🎶', '🎙️', '🚚', '📻', '🎷', '🎸', '🎹', '🎺', '🎻', '🥁'];
                break;
            case 'symbols':
                emojis = ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '#️⃣', '*️⃣', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '➕', '➖', '➗', '✖️', '💲', '💱'];
                break;
            case 'special':
                // Special characters
                emojis = ['©', '®', '™', '℠', '℗', '§', '¶', '†', '‡', '※', '♠', '♥', '♦', '♣', '☚', '☛', '☜', '☝', '☞', '☟', '✌', '✓', '✔', '✕', '✖', '✗', '✘', '☑', '☒', '✄', '✂', '✆', '✉', '☎', '☏', '✍', '✎', '✏', '❤', '❥', '♡', '❣', '★', '☆', '✯', '✰', '☽', '☾', '♫', '♬', '♪', '♩', '°', '′', '″', '×', '÷', '±', '∓', '≤', '≥', '≠', '∞', '∑', '√', '∛', '∜', '∫', '∮', '≈', '≡', '≅', '≤', '≥', '≦', '≧', '↔', '→', '←', '↑', '↓', '↕', '⇒', '⇔', '⟵', '⟶', '⟷', '€', '£', '¥', '¢', '$', '₹', '¤', '₿', '₽', '₩', '₱', '₳', '₴', '₭', '₦'];
                break;
        }
        
        emojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji;
            emojiItem.addEventListener('click', () => {
                this.insertAtCursor(emoji);
                document.querySelector('.emoji-backdrop').remove();
            });
            grid.appendChild(emojiItem);
        });
        
        container.innerHTML = '';
        container.appendChild(grid);
    }
    
    toggleFullscreen() {
        const container = document.querySelector('.notepad-container');
        container.classList.toggle('fullscreen-mode');
        
        // Toggle body class to prevent scrolling in fullscreen mode
        document.body.classList.toggle('has-fullscreen');
        
        const button = document.querySelector('[data-action="fullscreen"] i');
        if (container.classList.contains('fullscreen-mode')) {
            button.className = 'ri-fullscreen-exit-line';
            // Scroll to top to ensure proper display
            window.scrollTo(0, 0);
            // Add overflow hidden to html element as well
            document.documentElement.style.overflow = 'hidden';
        } else {
            button.className = 'ri-fullscreen-line';
            // Remove overflow hidden from html element
            document.documentElement.style.overflow = '';
        }
    }
    
    toggleDarkMode() {
        document.body.classList.toggle('dark-theme');
        
        const button = document.querySelector('[data-action="darkMode"] i');
        if (document.body.classList.contains('dark-theme')) {
            button.className = 'ri-sun-line';
            localStorage.setItem('darkMode', 'enabled');
        } else {
            button.className = 'ri-moon-line';
            localStorage.setItem('darkMode', 'disabled');
        }
    }
    
    setupWordCounter() {
        const notepad = document.getElementById('notepad');
        const counterElement = document.getElementById('word-counter');
        
        const updateCounter = () => {
            const text = notepad.innerText || '';
            const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
            const charCount = text.length;
            counterElement.textContent = `${wordCount} words | ${charCount} characters`;
        };
        
        notepad.addEventListener('input', updateCounter);
        notepad.addEventListener('paste', () => setTimeout(updateCounter, 100));
        notepad.addEventListener('keyup', updateCounter);
        
        // Call immediately to initialize the counter
        updateCounter();
    }
    
    setupSavedFilesToggle() {
        const toggleBtn = document.getElementById('toggleSavedFiles');
        const savedFilesList = document.getElementById('savedFilesList');
        const savedFilesHeader = document.querySelector('.saved-files-header');
        
        if (toggleBtn && savedFilesList && savedFilesHeader) {
            toggleBtn.addEventListener('click', () => {
                const isVisible = savedFilesList.style.display === 'flex';
                savedFilesList.style.display = isVisible ? 'none' : 'flex';
                toggleBtn.classList.toggle('collapsed');
            });
            
            savedFilesHeader.addEventListener('click', (e) => {
                if (!e.target.classList.contains('toggle-saved-btn') && !e.target.closest('.toggle-saved-btn')) {
                    const isVisible = savedFilesList.style.display === 'flex';
                    savedFilesList.style.display = isVisible ? 'none' : 'flex';
                    toggleBtn.classList.toggle('collapsed');
                }
            });
        }
    }
    
    printNotepad() {
        // Create a new window with just the notepad content
        const printWindow = window.open('', '_blank');
        
        // Add the content and necessary styles
        printWindow.document.write(`
            <html>
            <head>
                <title>Print Note</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                        line-height: 1.6;
                    }
                    img { max-width: 100%; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 8px; }
                </style>
            </head>
            <body>
                ${this.notepad.innerHTML}
            </body>
            </html>
        `);
        
        // Print and close
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.onafterprint = function() {
            printWindow.close();
        };
    }
    
    exportToPdf() {
        // Show loading toast
        this.showToast('Generating PDF...', 'info');
        
        try {
            // Create a clone of the notepad content for PDF generation
            const contentClone = document.createElement('div');
            contentClone.innerHTML = this.notepad.innerHTML;
            contentClone.style.padding = '20px';
            contentClone.style.fontSize = '12pt';
            contentClone.style.color = '#000';
            contentClone.style.background = '#fff';
            contentClone.style.fontFamily = 'Arial, Helvetica, sans-serif';
            contentClone.style.lineHeight = '1.5';
            
            // Add some basic styling to headings, paragraphs, and lists
            const headings = contentClone.querySelectorAll('h1, h2, h3, h4, h5, h6');
            headings.forEach(heading => {
                heading.style.marginBottom = '10px';
                heading.style.marginTop = '20px';
                heading.style.color = '#2d3748';
                heading.style.fontWeight = 'bold';
            });
            
            const paragraphs = contentClone.querySelectorAll('p');
            paragraphs.forEach(p => {
                p.style.marginBottom = '10px';
                p.style.textAlign = 'justify';
            });
            
            const lists = contentClone.querySelectorAll('ul, ol');
            lists.forEach(list => {
                list.style.marginLeft = '20px';
                list.style.marginBottom = '15px';
            });
            
            // Add borders to tables and style cells
            const tables = contentClone.querySelectorAll('table');
            tables.forEach(table => {
                table.style.borderCollapse = 'collapse';
                table.style.width = '100%';
                table.style.marginBottom = '15px';
                
                const cells = table.querySelectorAll('th, td');
                cells.forEach(cell => {
                    cell.style.border = '1px solid #cbd5e0';
                    cell.style.padding = '8px';
                    cell.style.textAlign = 'left';
                });
                
                const headers = table.querySelectorAll('th');
                headers.forEach(header => {
                    header.style.backgroundColor = '#f8fafc';
                    header.style.fontWeight = 'bold';
                });
            });
            
            // Style blockquotes
            const blockquotes = contentClone.querySelectorAll('blockquote');
            blockquotes.forEach(quote => {
                quote.style.borderLeft = '4px solid #6366f1';
                quote.style.paddingLeft = '15px';
                quote.style.margin = '15px 0';
                quote.style.fontStyle = 'italic';
                quote.style.color = '#4a5568';
            });
            
            // Style code blocks
            const codeBlocks = contentClone.querySelectorAll('pre, code');
            codeBlocks.forEach(block => {
                block.style.fontFamily = 'monospace';
                block.style.backgroundColor = '#f8fafc';
                block.style.padding = '10px';
                block.style.borderRadius = '5px';
                block.style.overflowX = 'auto';
                block.style.marginBottom = '15px';
            });
            
            // Set all images to have max width
            const images = contentClone.querySelectorAll('img');
            images.forEach(img => {
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.marginBottom = '15px';
                img.style.display = 'block';
                img.style.marginLeft = 'auto';
                img.style.marginRight = 'auto';
            });
            
            // Add a light watermark/header with document title
            const title = document.title || 'Exported Note';
            const header = document.createElement('div');
            header.style.textAlign = 'center';
            header.style.marginBottom = '20px';
            header.style.borderBottom = '1px solid #e2e8f0';
            header.style.paddingBottom = '10px';
            header.innerHTML = `<h2 style="color:#6366f1;margin:0;">${title}</h2>`;
            header.innerHTML += `<p style="color:#718096;font-size:10pt;margin-top:5px;">Exported on ${new Date().toLocaleString()}</p>`;
            contentClone.insertBefore(header, contentClone.firstChild);
            
            // Configure PDF options
            const options = {
                margin: [15, 15],
                filename: 'note.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            // Generate PDF using html2pdf.js
            html2pdf().from(contentClone).set(options).save()
                .then(() => {
                    this.showToast('PDF created successfully!', 'success');
                })
                .catch(error => {
                    console.error('PDF generation error:', error);
                    this.showToast('Error creating PDF. Try again.', 'error');
                });
        } catch (error) {
            console.error('PDF generation error:', error);
            this.showToast('Error creating PDF. Try again.', 'error');
        }
    }
    
    addBlockquoteExitBehavior() {
        const notepad = document.getElementById('notepad');
        notepad.addEventListener('keydown', (e) => {
            // Check if Enter is pressed
            if (e.key === 'Enter') {
                const selection = window.getSelection();
                if (!selection.isCollapsed) return; // Skip if text is selected
                
                const range = selection.getRangeAt(0);
                
                // Fix: Check node type before using closest() method
                let blockquote = null;
                if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
                    blockquote = range.startContainer.closest('blockquote');
                } else if (range.startContainer.nodeType === Node.TEXT_NODE) {
                    blockquote = range.startContainer.parentNode.closest('blockquote');
                }
                
                if (blockquote) {
                    // Check if cursor is at the end of the blockquote content
                    const isAtEnd = this.isCursorAtEndOfNode(blockquote);
                    
                    if (isAtEnd) {
                        e.preventDefault();
                        
                        // Create a new paragraph after the blockquote
                        const p = document.createElement('p');
                        p.innerHTML = '<br>'; // Empty paragraph needs BR to be visible
                        
                        // Insert after blockquote
                        blockquote.parentNode.insertBefore(p, blockquote.nextSibling);
                        
                        // Move cursor to new paragraph
                        const newRange = document.createRange();
                        newRange.selectNodeContents(p);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                        
                        // Ensure the editor has focus
                        this.notepad.focus();
                    }
                }
            }
        });
    }
    
    isCursorAtEndOfNode(node) {
        const selection = window.getSelection();
        if (!selection.isCollapsed) return false;
        
        const range = selection.getRangeAt(0);
        
        // Create a range that selects the entire contents of the node
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(node);
        nodeRange.collapse(false); // Collapse to end
        
        // Create a range from current position to the end of the node
        const testRange = range.cloneRange();
        testRange.setStart(range.startContainer, range.startOffset);
        testRange.setEndAfter(node);
        
        // If this range has no content, we're at the end
        return testRange.toString().trim() === '';
    }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.notepadApp = new NotepadApp();
});
