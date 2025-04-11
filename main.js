class NotepadApp {
    constructor() {
        this.notepad = document.getElementById('notepad');
        this.toolbarBtns = document.querySelectorAll('.toolbar-btn');
        this.fontSelector = document.getElementById('fontSelector');
        this.fontSizeSelector = document.getElementById('fontSizeSelector');
        this.savedFilesContainer = document.getElementById('savedFilesContainer');
        this.savedFilesList = document.getElementById('savedFilesList');
        this.toggleSavedFilesBtn = document.getElementById('toggleSavedFiles');
        this.hasUnsavedChanges = false;
        this.savedContent = '';
        this.undoStack = [];  
        this.redoStack = [];
        this.lastSavedState = '';
        this.isUndoRedo = false;
        this.currentNoteId = null;
        this.savedNotes = {};

        this.savedRange = null;
        this.autoSaveInterval = null;
        this.initAutoSave();

        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.initTheme();

        this.setupEventListeners();
        this.loadSavedNotes();
        this.renderSavedFiles();
        
        // Initialize toggle button as collapsed
        this.toggleSavedFilesBtn.classList.add('collapsed');

        // Initialize undo stack with current content (which might be empty)
        this.undoStack.push(this.notepad.innerHTML);
    }

    setupEventListeners() {
        this.notepad.addEventListener('input', () => {
            if (!this.isUndoRedo) {
                this.undoStack.push(this.notepad.innerHTML);
                this.redoStack = [];
            }
            this.isUndoRedo = false;
            this.updateStats();
            this.checkForChanges();
        });
        
        // Handle paste events to retain formatting in a compatible way
        this.notepad.addEventListener('paste', (e) => {
            e.preventDefault();
            
            // Get clipboard content as HTML and as plain text
            const htmlContent = e.clipboardData.getData('text/html');
            const plainText = e.clipboardData.getData('text/plain');
            
            // Use HTML if available (to preserve formatting), otherwise use plain text
            if (htmlContent) {
                // Create a temporary div to process the HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlContent;
                
                // Process HTML to make formats compatible with the editor
                this.processFormattedPaste(tempDiv);
                
                // Insert the processed content
                document.execCommand('insertHTML', false, tempDiv.innerHTML);
            } else {
                document.execCommand('insertText', false, plainText);
            }
            
            // Update undo stack and mark changes
            this.undoStack.push(this.notepad.innerHTML);
            this.checkForChanges();
        });
        
        // Make the notepad focused when clicked anywhere inside
        this.notepad.addEventListener('click', () => {
            this.notepad.focus();
        });
        
        this.toolbarBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent any default action
                this.saveSelection(); // Save selection before handling action
                this.handleToolbarAction(btn.dataset.action);
            });
        });
        
        // Add keyboard shortcut support for common actions
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.handleToolbarAction('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.handleToolbarAction('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.handleToolbarAction('underline');
                        break;
                    case 's':
                        e.preventDefault();
                        this.handleToolbarAction('save');
                        break;
                    case 'z':
                        e.preventDefault();
                        this.handleToolbarAction('undo');
                        break;
                    case 'y':
                        e.preventDefault();
                        this.handleToolbarAction('redo');
                        break;
                }
            }
        });

        this.fontSelector.addEventListener('change', (e) => {
            this.saveSelection();
            this.applyFontWithSelectionPreserved(e.target.value);
        });
        
        this.fontSizeSelector.addEventListener('change', (e) => {
            this.saveSelection();
            this.applyFontSizeWithSelectionPreserved(e.target.value + 'px');
        });

        // Make the entire header clickable
        document.querySelector('.saved-files-header').addEventListener('click', () => {
            this.toggleSavedFilesPanel();
        });
        
        // Prevent propagation when clicking the toggle button directly
        this.toggleSavedFilesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSavedFilesPanel();
        });
        
        // Update the color picker event listener to use our custom selection-based color change
        // Add listeners to capture the current selection whenever the user clicks or types in the notepad
        this.notepad.addEventListener('mouseup', () => { this.saveSelection(); });
        this.notepad.addEventListener('keyup', () => { this.saveSelection(); });

        this.notepad.addEventListener('click', (event) => {
            if (event.target.tagName === 'A' && event.target.dataset.dynamicLink === 'true') {
                event.preventDefault(); // Prevent navigation
                this.modifyOrRemoveLink(event.target);
            }
        });

        // Add file import listener to a new toolbar button
        document.querySelector('[data-action="import"]').addEventListener('click', () => {
            this.importFile();
        });
        
        // Add dark mode toggle event listener
        document.querySelector('[data-action="darkMode"]').addEventListener('click', () => {
            this.toggleDarkMode();
        });

        // Add color picker event listeners
        document.getElementById('textColor').addEventListener('input', (e) => {
            this.saveSelection();
            this.applyTextColor(e.target.value);
        });
        
        document.getElementById('highlightColor').addEventListener('input', (e) => {
            this.saveSelection();
            this.applyHighlightColor(e.target.value);
        });
    }

    processFormattedPaste(container) {
        // Convert common formatted elements to spans with inline styles
        const processNode = (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Process various formatting tags
                if (node.tagName === 'B' || node.tagName === 'STRONG') {
                    const span = document.createElement('span');
                    span.style.fontWeight = 'bold';
                    while (node.firstChild) {
                        span.appendChild(node.firstChild);
                    }
                    node.parentNode.replaceChild(span, node);
                    return span;
                } else if (node.tagName === 'I' || node.tagName === 'EM') {
                    const span = document.createElement('span');
                    span.style.fontStyle = 'italic';
                    while (node.firstChild) {
                        span.appendChild(node.firstChild);
                    }
                    node.parentNode.replaceChild(span, node);
                    return span;
                } else if (node.tagName === 'U') {
                    const span = document.createElement('span');
                    span.style.textDecoration = 'underline';
                    while (node.firstChild) {
                        span.appendChild(node.firstChild);
                    }
                    node.parentNode.replaceChild(span, node);
                    return span;
                } else {
                    // Process children recursively
                    Array.from(node.childNodes).forEach(child => {
                        processNode(child);
                    });
                }
            }
            return node;
        };
        
        // Process all nodes in the pasted content
        Array.from(container.childNodes).forEach(node => {
            processNode(node);
        });
    }

    initTheme() {
        if (this.isDarkMode) {
            document.body.classList.add('dark-theme');
            document.querySelector('[data-action="darkMode"] i').classList.remove('ri-moon-line');
            document.querySelector('[data-action="darkMode"] i').classList.add('ri-sun-line');
        }
    }
    
    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('darkMode', this.isDarkMode);
        
        const darkModeIcon = document.querySelector('[data-action="darkMode"] i');
        if (this.isDarkMode) {
            darkModeIcon.classList.remove('ri-moon-line');
            darkModeIcon.classList.add('ri-sun-line');
        } else {
            darkModeIcon.classList.remove('ri-sun-line');
            darkModeIcon.classList.add('ri-moon-line');
        }
    }

    toggleSavedFilesPanel() {
        const filesList = this.savedFilesList;
        const toggleBtn = this.toggleSavedFilesBtn;
        
        if (filesList.style.display === 'none' || filesList.style.display === '') {
            filesList.style.display = 'flex';
            toggleBtn.classList.remove('collapsed');
        } else {
            filesList.style.display = 'none';
            toggleBtn.classList.add('collapsed');
        }
    }

    loadSavedNotes() {
        const savedNotesJSON = localStorage.getItem('savedNotes');
        if (savedNotesJSON) {
            this.savedNotes = JSON.parse(savedNotesJSON);
        }
        
        // Backward compatibility with previous version
        const oldSavedNote = localStorage.getItem('savedNote');
        if (oldSavedNote && Object.keys(this.savedNotes).length === 0) {
            const noteId = 'note_' + Date.now();
            this.savedNotes[noteId] = {
                content: oldSavedNote,
                title: this.generateTitle(oldSavedNote),
                lastModified: new Date().toISOString()
            };
            localStorage.setItem('savedNotes', JSON.stringify(this.savedNotes));
            localStorage.removeItem('savedNote'); // Remove old format
        }
        
        // Load the most recent note if available
        if (Object.keys(this.savedNotes).length > 0) {
            // Sort by last modified date and get the most recent
            const sortedNotes = Object.entries(this.savedNotes)
                .sort((a, b) => new Date(b[1].lastModified) - new Date(a[1].lastModified));
            
            if (sortedNotes.length > 0) {
                const [noteId, note] = sortedNotes[0];
                this.loadNote(noteId);
            }
        }
    }

    renderSavedFiles() {
        this.savedFilesList.innerHTML = '';
        
        if (Object.keys(this.savedNotes).length === 0) {
            this.savedFilesList.innerHTML = `
                <div class="empty-files-message">No saved notes yet</div>
            `;
            return;
        }
        
        // Sort notes by last modified date (newest first)
        const sortedNotes = Object.entries(this.savedNotes)
            .sort((a, b) => new Date(b[1].lastModified) - new Date(a[1].lastModified));
        
        for (const [noteId, note] of sortedNotes) {
            const isActive = noteId === this.currentNoteId;
            const noteCard = document.createElement('div');
            noteCard.className = `saved-file-card ${isActive ? 'active' : ''}`;
            noteCard.dataset.noteId = noteId;
            
            const formattedDate = this.formatDate(new Date(note.lastModified));
            
            noteCard.innerHTML = `
                <div class="saved-file-title">${note.title || 'Untitled Note'}</div>
                <div class="saved-file-preview">${note.content.substring(0, 120)}</div>
                <div class="saved-file-date">${formattedDate}</div>
                <div class="saved-file-actions">
                    <button class="file-action-btn rename-note" data-note-id="${noteId}">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button class="file-action-btn delete-note" data-note-id="${noteId}">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            `;
            
            noteCard.addEventListener('click', (e) => {
                // Ignore clicks on action buttons
                if (!e.target.closest('.delete-note') && !e.target.closest('.rename-note')) {
                    this.loadNote(noteId);
                }
            });
            
            this.savedFilesList.appendChild(noteCard);
        }
        
        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                const noteId = btn.dataset.noteId;
                this.deleteNote(noteId);
            });
        });

        // Add event listeners for rename buttons
        document.querySelectorAll('.rename-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click
                const noteId = btn.dataset.noteId;
                this.showRenameDialog(noteId);
            });
        });
    }
    
    showRenameDialog(noteId) {
        const note = this.savedNotes[noteId];
        if (!note) return;
        
        const modal = document.createElement('div');
        modal.className = 'save-modal';
        modal.innerHTML = `
            <div class="save-modal-content rename-modal">
                <h3>Rename Note</h3>
                <input type="text" id="rename-input" value="${note.title || 'Untitled Note'}" 
                    class="rename-input" placeholder="Enter a new name">
                <div class="save-modal-buttons rename-buttons">
                    <button id="modal-rename">Rename</button>
                    <button id="modal-cancel-rename">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus the input field
        const renameInput = document.getElementById('rename-input');
        renameInput.focus();
        renameInput.select();
        
        // Add event listeners
        document.getElementById('modal-rename').addEventListener('click', () => {
            const newTitle = renameInput.value.trim() || 'Untitled Note';
            this.renameNote(noteId, newTitle);
            document.body.removeChild(modal);
        });
        
        document.getElementById('modal-cancel-rename').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Handle Enter key press
        renameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const newTitle = renameInput.value.trim() || 'Untitled Note';
                this.renameNote(noteId, newTitle);
                document.body.removeChild(modal);
            }
        });
    }
    
    renameNote(noteId, newTitle) {
        if (this.savedNotes[noteId]) {
            this.savedNotes[noteId].title = newTitle;
            localStorage.setItem('savedNotes', JSON.stringify(this.savedNotes));
            this.renderSavedFiles();
            this.createToast('Note renamed successfully!');
        }
    }

    formatDate(date) {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        
        if (date.toDateString() === now.toDateString()) {
            return `Today, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else if (date.toDateString() === yesterday.toDateString()) {
            return `Yesterday, ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else {
            return date.toLocaleDateString([], {
                month: 'short', 
                day: 'numeric',
                year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined
            });
        }
    }

    generateTitle(content) {
        // Extract first line or first few words as title
        const firstLine = content.split('\n')[0].trim();
        if (firstLine.length > 0) {
            return firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine;
        }
        return 'Untitled Note';
    }

    loadNote(noteId) {
        if (this.hasUnsavedChanges) {
            // Show save dialog before loading another note
            this.showSaveDialog(() => this.doLoadNote(noteId));
            return;
        }
        
        this.doLoadNote(noteId);
    }
    
    doLoadNote(noteId) {
        const note = this.savedNotes[noteId];
        if (note) {
            this.notepad.innerHTML = note.content;
            this.savedContent = note.content;
            this.currentNoteId = noteId;
            this.hasUnsavedChanges = false;
            this.updateStats();
            this.undoStack = [note.content];
            this.redoStack = [];
            
            // Update active state in UI
            this.renderSavedFiles();
        }
    }

    deleteNote(noteId) {
        this.showDeleteConfirmDialog(noteId);
    }
    
    showDeleteConfirmDialog(noteId) {
        const modal = document.createElement('div');
        modal.className = 'save-modal';
        modal.innerHTML = `
            <div class="save-modal-content">
                <h3>Delete Note</h3>
                <p>Are you sure you want to delete this note? This action cannot be undone.</p>
                <div class="save-modal-buttons">
                    <button id="modal-confirm-delete" style="background-color: #f44336;">Delete</button>
                    <button id="modal-cancel-delete">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('modal-confirm-delete').addEventListener('click', () => {
            delete this.savedNotes[noteId];
            localStorage.setItem('savedNotes', JSON.stringify(this.savedNotes));
            
            // If the deleted note was the current note, clear the editor
            if (noteId === this.currentNoteId) {
                this.createNewNote();
            }
            
            this.renderSavedFiles();
            document.body.removeChild(modal);
            this.createToast('Note deleted successfully', 'success');
        });
        
        document.getElementById('modal-cancel-delete').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    checkForChanges() {
        this.hasUnsavedChanges = this.notepad.innerHTML !== this.savedContent;
    }

    handleToolbarAction(action) {
        // Ensure notepad is focused for all actions
        this.notepad.focus(); 
        
        switch(action) {
            case 'new':
            case 'save':
            case 'download':
            case 'import':
            case 'print':
            case 'bold':
            case 'italic':
            case 'underline':
            case 'emoji':
            case 'link':
            case 'image':
            case 'undo':
            case 'redo':
            case 'fullscreen':
                // Handle existing actions
                this.handleExistingAction(action);
                break;
            case 'strikethrough':
                this.applyFormattingWithSelectionPreserved('strikethrough');
                break;
            case 'justifyLeft':
            case 'justifyCenter':
            case 'justifyRight':
            case 'justifyFull':
                document.execCommand(action, false, null);
                this.setActiveAlignment(action);
                break;
            case 'insertOrderedList':
            case 'insertUnorderedList':
                document.execCommand(action, false, null);
                break;
            case 'removeFormat':
                document.execCommand(action, false, null);
                break;
            default:
                // Handle other existing actions
                this.handleExistingAction(action);
        }
        
        // Update active state for applicable formatting buttons
        this.updateToolbarState();
    }
    
    handleExistingAction(action) {
        switch(action) {
            case 'new':
                this.createNewNote();
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
                this.printNote();
                break;
            case 'bold':
            case 'italic':
            case 'underline':
                document.execCommand(action, false, null);
                break;
            case 'emoji':
                this.showEmojiPicker();
                break;
            case 'link':
                this.showLinkDialog();
                break;
            case 'image':
                this.showImageDialog();
                break;
            case 'undo':
                this.undo();
                break;
            case 'redo':
                this.redo();
                break;
            case 'fullscreen':
                this.toggleFullscreen();
                break;
        }
    }
    
    setActiveAlignment(activeAction) {
        const alignActions = ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'];
        
        alignActions.forEach(action => {
            const button = document.querySelector(`[data-action="${action}"]`);
            if (button) {
                if (action === activeAction) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            }
        });
    }
    
    updateToolbarState() {
        // Update formatting buttons
        const formattingActions = ['bold', 'italic', 'underline', 'strikethrough'];
        formattingActions.forEach(action => {
            const button = document.querySelector(`[data-action="${action}"]`);
            if (button) {
                button.classList.toggle('active', document.queryCommandState(action));
            }
        });
        
        // Update alignment buttons
        const alignmentStates = ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'];
        alignmentStates.forEach(state => {
            if (document.queryCommandState(state)) {
                this.setActiveAlignment(state);
            }
        });
        
        // Update list buttons
        const listActions = ['insertOrderedList', 'insertUnorderedList'];
        listActions.forEach(action => {
            const button = document.querySelector(`[data-action="${action}"]`);
            if (button) {
                button.classList.toggle('active', document.queryCommandState(action));
            }
        });
    }
    
    applyTextColor(color) {
        if (this.restoreSelection()) {
            document.execCommand('foreColor', false, color);
            this.undoStack.push(this.notepad.innerHTML);
            this.redoStack = [];
            this.checkForChanges();
        }
    }
    
    applyHighlightColor(color) {
        if (this.restoreSelection()) {
            document.execCommand('hiliteColor', false, color);
            this.undoStack.push(this.notepad.innerHTML);
            this.redoStack = [];
            this.checkForChanges();
        }
    }

    createNewNote() {
        if (this.notepad.innerHTML.trim() !== '' && this.hasUnsavedChanges) {
            this.showSaveDialog(() => this.clearNotepad());
        } else {
            this.clearNotepad();
        }
    }

    showSaveDialog(onComplete = null) {
        const modal = document.createElement('div');
        modal.className = 'save-modal';
        modal.innerHTML = `
            <div class="save-modal-content">
                <h3>Save your work?</h3>
                <p>Your note has unsaved changes. What would you like to do?</p>
                <div class="save-modal-buttons">
                    <button id="modal-save">Save Note</button>
                    <button id="modal-export">Export File</button>
                    <button id="modal-discard">Discard</button>
                    <button id="modal-cancel">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add subtle animation when buttons are pressed
        const buttons = modal.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('mousedown', () => {
                button.style.transform = 'scale(0.98)';
            });
            button.addEventListener('mouseup', () => {
                button.style.transform = '';
            });
        });
        
        document.getElementById('modal-save').addEventListener('click', () => {
            this.saveNote();
            if (onComplete) onComplete();
            document.body.removeChild(modal);
        });
        
        document.getElementById('modal-discard').addEventListener('click', () => {
            if (onComplete) onComplete();
            document.body.removeChild(modal);
        });
        
        document.getElementById('modal-export').addEventListener('click', () => {
            this.downloadNote();
            document.body.removeChild(modal);
        });
        
        document.getElementById('modal-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    updateStats() {
    }

    clearNotepad() {
        this.notepad.innerHTML = '';
        this.savedContent = '';
        this.hasUnsavedChanges = false;
        this.currentNoteId = null;
    }

    createToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <div class="toast-progress"></div>
        `;
        
        document.body.appendChild(toast);
        
        // Remove toast after animation
        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 500);
        }, 3000);
    }

    getToastIcon(type) {
        const icons = {
            'success': 'ri-check-line',
            'error': 'ri-error-warning-line',
            'warning': 'ri-alert-line'
        };
        return icons[type] || 'ri-information-line';
    }

    applyFontWithSelectionPreserved(fontFamily) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        if (range.collapsed) {
            // Create a temporary span if no text is selected
            const tempSpan = document.createElement('span');
            tempSpan.textContent = '\u200B'; // Zero-width space
            tempSpan.style.fontFamily = fontFamily;
            
            range.insertNode(tempSpan);
            
            // Position cursor after the temp span
            const newRange = document.createRange();
            newRange.setStartAfter(tempSpan);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            // Format selected text
            const selectedContent = range.extractContents();
            
            // Create a container for the selected content
            const span = document.createElement('span');
            span.style.fontFamily = fontFamily;
            
            // Handle nested spans with existing font-family settings
            const processNodes = (parent, container) => {
                Array.from(parent.childNodes).forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'SPAN') {
                        // Create a new span that combines styles
                        const newSpan = document.createElement('span');
                        // Copy all styles except font-family
                        for (let i = 0; i < node.style.length; i++) {
                            const styleName = node.style[i];
                            if (styleName !== 'fontFamily') {
                                newSpan.style[styleName] = node.style[styleName];
                            }
                        }
                        // Set the new font family
                        newSpan.style.fontFamily = fontFamily;
                        
                        // Process children recursively
                        processNodes(node, newSpan);
                        container.appendChild(newSpan);
                    } else {
                        // Clone other nodes as-is
                        container.appendChild(node.cloneNode(true));
                    }
                });
            };
            
            // Process the selected content
            processNodes(selectedContent, span);
            
            // Insert the modified content
            range.insertNode(span);
            
            // Restore selection
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNode(span);
            selection.addRange(newRange);
        }
        
        if (!this.isUndoRedo) {
            this.undoStack.push(this.notepad.innerHTML);
            this.redoStack = [];
        }
        this.checkForChanges();
        setTimeout(() => this.notepad.focus(), 0);
    }

    applyFontSizeWithSelectionPreserved(fontSize) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        if (range.collapsed) {
            // Create a temporary span if no text is selected
            const tempSpan = document.createElement('span');
            tempSpan.textContent = '\u200B'; // Zero-width space
            tempSpan.style.fontSize = fontSize;
            
            range.insertNode(tempSpan);
            
            // Position cursor after the temp span
            const newRange = document.createRange();
            newRange.setStartAfter(tempSpan);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            // Format selected text
            const selectedContent = range.extractContents();
            const span = document.createElement('span');
            span.style.fontSize = fontSize;
            span.appendChild(selectedContent);
            range.insertNode(span);
            
            // Restore selection
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.addRange(newRange);
        }
        
        if (!this.isUndoRedo) {
            this.undoStack.push(this.notepad.innerHTML);
            this.redoStack = [];
        }
        this.checkForChanges();
        setTimeout(() => this.notepad.focus(), 0);
    }

    undo() {
        if (this.undoStack.length > 1) { 
            // Save current state to redo stack before going back
            this.redoStack.push(this.notepad.innerHTML);
            
            // Remove current state from undo stack
            this.undoStack.pop(); 
            
            // Get the previous state
            const previousState = this.undoStack[this.undoStack.length - 1]; 
            
            this.isUndoRedo = true;
            
            // Apply the previous state to the notepad
            this.notepad.innerHTML = previousState;
            this.updateStats();
            this.checkForChanges();
            
            // Ensure focus remains in the editor
            this.notepad.focus();
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            // Save current state to undo stack
            this.undoStack.push(this.notepad.innerHTML);
            
            // Get the next state from redo stack
            const nextState = this.redoStack.pop();
            
            this.isUndoRedo = true;
            
            // Apply the next state to the notepad
            this.notepad.innerHTML = nextState;
            this.updateStats();
            this.checkForChanges();
            
            // Ensure focus remains in the editor
            this.notepad.focus();
        }
    }

    scrollNotepadContentInFullscreen() {
        if (document.querySelector('.notepad-container.fullscreen-mode')) {
            const notepad = document.getElementById('notepad');
            notepad.style.maxHeight = 'calc(100vh - 150px)'; 
            notepad.style.overflowY = 'auto';
        } else {
            const notepad = document.getElementById('notepad');
            notepad.style.maxHeight = '75vh';
        }
    }

    toggleFullscreen() {
        const container = document.querySelector('.notepad-container');
        container.classList.toggle('fullscreen-mode');
        
        const button = document.querySelector('[data-action="fullscreen"]');
        const icon = button.querySelector('i');
        if (icon) {
            const isFullscreen = container.classList.contains('fullscreen-mode');
            icon.className = isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line';
            button.classList.toggle('active', isFullscreen);
        }
        
        this.scrollNotepadContentInFullscreen();
        
        // Hide/show elements when in fullscreen mode
        document.querySelectorAll('.ad-container, .saved-files-container, .tool-description, .guide-section').forEach(el => {
            el.style.display = container.classList.contains('fullscreen-mode') ? 'none' : '';
        });
        
        // Force layout recalculation to ensure full width
        if (container.classList.contains('fullscreen-mode')) {
            setTimeout(() => {
                container.style.width = '100%';
                container.style.maxWidth = '100%';
            }, 0);
        }
    }

    saveNote() {
        const content = this.notepad.innerHTML;
        const title = this.generateTitle(this.notepad.innerText);
        const lastModified = new Date().toISOString();
        
        if (!this.currentNoteId) {
            this.currentNoteId = 'note_' + Date.now();
        }
        
        this.savedNotes[this.currentNoteId] = {
            content,
            title,
            lastModified
        };
        
        localStorage.setItem('savedNotes', JSON.stringify(this.savedNotes));
        this.savedContent = content;
        this.hasUnsavedChanges = false;
        this.lastSavedState = content;
        
        this.renderSavedFiles();
        this.createToast('Note saved successfully!', 'success');
    }

    downloadNote() {
        this.showDownloadFormatDialog().then(fileFormat => {
            if (!fileFormat) return; 
            
            if (fileFormat === 'pdf') {
                this.createPDF();
                return;
            }
            
            if (fileFormat === 'docx') {
                this.createDOCX();
                return;
            }
            
            let mimeType, extension, content;
            switch(fileFormat) {
                case 'txt':
                    mimeType = 'text/plain';
                    extension = 'txt';
                    content = this.notepad.innerText;
                    break;
                case 'html':
                    mimeType = 'text/html';
                    extension = 'html';
                    content = this.notepad.innerHTML;
                    break;
                case 'md':
                    mimeType = 'text/markdown';
                    extension = 'md';
                    content = this.notepad.innerText;
                    break;
                case 'rtf':
                    mimeType = 'application/rtf';
                    extension = 'rtf';
                    content = this.createRTFContent();
                    break;
                default:
                    mimeType = 'text/plain';
                    extension = 'txt';
                    content = this.notepad.innerText;
            }
            
            const blob = new Blob([content], {type: mimeType});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `note.${extension}`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
    
    createRTFContent() {
        // Basic RTF header
        let rtfContent = "{\\rtf1\\ansi\\ansicpg1252\\cocoartf2580\\cocoasubrtf220\n";
        rtfContent += "{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;}\n";
        rtfContent += "{\\colortbl;\\red0\\green0\\blue0;}\n";
        rtfContent += "\\margl1440\\margr1440\\vieww10800\\viewh8400\\viewkind0\n";
        rtfContent += "\\pard\\tx720\\tx1440\\tx2160\\tx2880\\tx3600\\tx4320\\tx5040\\tx5760\\tx6480\\tx7200\\tx7920\\tx8640\\pardirnatural\\partightenfactor0\n\n";
        
        // Get text with preserved line breaks
        const textContent = this.notepad.innerText.replace(/\n/g, "\\par\n");
        rtfContent += "\\f0\\fs24 " + textContent + "\n}";
        
        return rtfContent;
    }

    createPDF() {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Notepad Export</title>
                <style>
                    body { 
                        font-family: ${this.notepad.style.fontFamily || 'Arial'}; 
                        font-size: ${this.notepad.style.fontSize || '16px'};
                        line-height: 1.6;
                        white-space: pre-wrap;
                        margin: 40px;
                    }
                    p { margin: 0.5em 0; }
                    a { color: #6366f1; }
                    img { max-width: 100%; height: auto; }
                    span { display: inline-block; }
                </style>
            </head>
            <body>
                ${this.notepad.innerHTML}
            </body>
            </html>
        `;
        
        const blob = new Blob([htmlContent], {type: 'text/html'});
        const url = URL.createObjectURL(blob);
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        document.body.appendChild(script);
        
        script.onload = () => {
            const element = document.createElement('div');
            element.innerHTML = this.notepad.innerHTML;
            element.style.fontFamily = this.notepad.style.fontFamily || 'Arial';
            element.style.fontSize = this.notepad.style.fontSize || '16px';
            element.style.lineHeight = '1.6';
            element.style.whiteSpace = 'pre-wrap';
            element.style.padding = '20px';
            document.body.appendChild(element);
            
            const opt = {
                margin: [0.8, 0.8, 0.8, 0.8],
                filename: 'note.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, letterRendering: true, useCORS: true },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
                preserveStyles: true
            };
            
            html2pdf().from(element).set(opt).save().then(() => {
                document.body.removeChild(element);
                document.body.removeChild(script);
                this.createToast('PDF downloaded successfully!', 'success');
            });
        };
    }
    
    createDOCX() {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/docx@7.1.0/build/index.js';
        document.body.appendChild(script);
        
        script.onload = () => {
            const { Document, Packer, Paragraph, TextRun } = docx;
            
            // Split content by line breaks and create paragraphs
            const paragraphs = this.notepad.innerText.split('\n').map(line => {
                return new Paragraph({
                    children: [new TextRun(line)],
                    spacing: {
                        after: 200
                    }
                });
            });
            
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: paragraphs
                }]
            });
            
            Packer.toBlob(doc).then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'note.docx';
                a.click();
                URL.revokeObjectURL(url);
                document.body.removeChild(script);
                this.createToast('DOCX downloaded successfully!', 'success');
            });
        };
    }

    showDownloadFormatDialog() {
        const modal = document.createElement('div');
        modal.className = 'save-modal';
        modal.innerHTML = `
            <div class="save-modal-content download-format-modal">
                <h3>Export File</h3>
                <div class="format-options horizontal">
                    <div class="format-option" data-format="docx">
                        <i class="ri-file-word-2-line"></i>
                        <span>Word (.docx)</span>
                    </div>
                </div>
                <p class="conversion-note">Need other formats? You can convert your .docx file to PDF, TXT and more using external converters after download.</p>
                <div class="save-modal-buttons">
                    <button id="export-docx-btn">Export</button>
                    <button id="convert-docx-btn">Convert</button>
                    <button id="modal-cancel-download">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        return new Promise(resolve => {
            document.querySelector('.format-option[data-format="docx"]').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve('docx');
            });
            
            document.getElementById('export-docx-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve('docx');
            });
            
            document.getElementById('convert-docx-btn').addEventListener('click', () => {
                window.open('https://www.online-convert.com/file-format/docx', '_blank');
                document.body.removeChild(modal);
                resolve(null);
            });
            
            document.getElementById('modal-cancel-download').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(null);
            });
        });
    }

    saveSelection() {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
            
            // Store the parent element for context
            if (this.savedRange.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
                this.selectedContext = this.savedRange.commonAncestorContainer.parentNode;
            } else {
                this.selectedContext = this.savedRange.commonAncestorContainer;
            }
        }
    }

    restoreSelection() {
        if (this.savedRange && this.notepad.contains(this.savedRange.commonAncestorContainer)) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedRange);
            return true;
        }
        return false;
    }

    showEmojiPicker() {
        this.saveSelection();
        
        // Check if there's no valid selection or if the selection is outside the notepad
        if (!this.savedRange || !this.notepad.contains(this.savedRange.commonAncestorContainer)) {
            this.createToast('Please select a location inside the notepad to insert an emoji.', 'warning');
            this.notepad.focus();
            return;
        }
        
        const backdrop = document.createElement('div');
        backdrop.className = 'emoji-backdrop';
        
        const modal = document.createElement('div');
        modal.className = 'emoji-modal';
        modal.innerHTML = `
            <div class="emoji-modal-header">
                <h3>Emojis & Special Characters</h3>
                <button class="emoji-close-btn">&times;</button>
            </div>
            <div class="emoji-tabs">
                <div class="emoji-tab active" data-tab="emoji">😀 Emojis</div>
                <div class="emoji-tab" data-tab="special">✓ Special Characters</div>
                <div class="emoji-tab" data-tab="math">∑ Math Symbols</div>
                <div class="emoji-tab" data-tab="arrows">← Arrows</div>
                <div class="emoji-tab" data-tab="currency">$ Currency</div>
            </div>
            <div class="emoji-content"></div>
        `;
        
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);
        
        this.loadEmojiTab('emoji');
        
        document.querySelector('.emoji-close-btn').addEventListener('click', () => {
            document.body.removeChild(backdrop);
            document.body.removeChild(modal);
        });
        
        backdrop.addEventListener('click', () => {
            document.body.removeChild(backdrop);
            document.body.removeChild(modal);
        });
        
        document.querySelectorAll('.emoji-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.loadEmojiTab(tab.dataset.tab);
            });
        });
    }
    
    loadEmojiTab(tab, searchTerm = '') {
        const emojiContent = document.querySelector('.emoji-content');
        let content = '';
        
        switch(tab) {
            case 'emoji':
                const emojis = [
                    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', 
                    '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', 
                    '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', 
                    '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', 
                    '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', 
                    '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', 
                    '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', 
                    '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', 
                    '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', 
                    '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻',
                    '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀',
                    '😿', '😾', '🙈', '🙉', '🙊', '💋', '💌', '💘', '💝', '💖',
                    '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛',
                    '💚', '💙', '💜', '🤎', '🖤', '🤍', '💯', '💢', '💥', '💫'
                ];
                
                content = '<div class="emoji-grid">';
                emojis.forEach(emoji => {
                    content += `<div class="emoji-item" data-char="${emoji}">${emoji}</div>`;
                });
                content += '</div>';
                break;
                
            case 'special':
                const specialChars = [
                    '©', '®', '™', '§', '¶', '†', '‡', '•', '·', '…',
                    '‰', '‱', '′', '″', '‴', '‵', '‶', '‷', '⁂', '⁃',
                    '⁄', '⁎', '⁏', '⁑', '⁓', '⁕', '⁖', '⁘', '⁙', '⁚',
                    '⁛', '⁜', '⁝', '⁞', '°', '±', '÷', '×', '≈', '≠',
                    '≤', '≥', '∞', '√', '∛', '∜', '∟', '∠', '∡', '∢',
                    '∩', '∪', '∫', '∬', '∭', '∮', '∯', '∰', '∱', '∲',
                    '∳', '≡', '≢', '≣', '≤', '≥', '≦', '≧', '≨', '≩',
                    '≪', '≫', '≬', '≭', '≮', '≯', '≰', '≱', '≲', '≳',
                    '≴', '≵', '≶', '≷', '≸', '≹', '≺', '≻', '≼', '≽',
                    '≾', '≿', '⊀', '⊁', '⊂', '⊃', '⊄', '⊅', '⊆', '⊇'
                ];
                
                content = '<div class="special-char-grid">';
                specialChars.forEach(char => {
                    content += `<div class="special-char-item" data-char="${char}">${char}</div>`;
                });
                content += '</div>';
                break;
                
            case 'math':
                const mathSymbols = [
                    '+', '−', '×', '÷', '=', '≠', '≈', '<', '>', '≤',
                    '≥', '±', '∓', '∞', '∝', '∑', '∏', '∂', '∆', '√',
                    '∛', '∜', '∫', '∬', '∭', '∮', '∇', '∴', '∵', '∶',
                    '∷', '∼', '∽', '∾', '≀', '≁', '≂', '≃', '≄', '≅',
                    '≆', '≇', '≈', '≉', '≊', '≋', '≌', '≍', '≎', '≏',
                    '⊕', '⊖', '⊗', '⊘', '⊙', '⊚', '⊛', '⊜', '⊝', '⊞',
                    '⊟', '⊠', '⊡', '⊢', '⊣', '⊤', '⊥', '⊦', '⊧', '⊨',
                    '⊩', '⊪', '⊫', '⊬', '⊭', '⊮', '⊯', '⋀', '⋁', '⋂',
                    '⋃', '⋄', '⋅', '⋆', '⋇', '⋈', '⋉', '⋊', '⋋', '⋌',
                    '⋍', '⋎', '⋏', '⋐', '⋑', '⋒', '⋓', '⋔', '⋕', '⋖'
                ];
                
                content = '<div class="special-char-grid">';
                mathSymbols.forEach(char => {
                    content += `<div class="special-char-item" data-char="${char}">${char}</div>`;
                });
                content += '</div>';
                break;
                
            case 'arrows':
                const arrows = [
                    '←', '→', '↑', '↓', '↔', '↕', '↖', '↗', '↘', '↙',
                    '↚', '↛', '↜', '↝', '↞', '↟', '↠', '↡', '↢', '↣',
                    '↤', '↥', '↦', '↧', '↨', '↩', '↪', '↫', '↬', '↭',
                    '↮', '↯', '↰', '↱', '↲', '↳', '↴', '↵', '↶', '↷',
                    '↸', '↹', '↺', '↻', '↼', '↽', '↾', '↿', '⇀', '⇁',
                    '⇂', '⇃', '⇄', '⇅', '⇆', '⇇', '⇈', '⇉', '⇊', '⇋',
                    '⇌', '⇍', '⇎', '⇏', '⇐', '⇑', '⇒', '⇓', '⇔', '⇕',
                    '⇖', '⇗', '⇘', '⇙', '⇚', '⇛', '⇜', '⇝', '⇞', '⇟',
                    '⇠', '⇡', '⇢', '⇣', '⇤', '⇥', '⇦', '⇧', '⇨', '⇩',
                    '⇪', '⇫', '⇬', '⇭', '⇮', '⇯', '⇰', '⇱', '⇲', '⇳'
                ];
                
                content = '<div class="special-char-grid">';
                arrows.forEach(char => {
                    content += `<div class="special-char-item" data-char="${char}">${char}</div>`;
                });
                content += '</div>';
                break;
                
            case 'currency':
                const currency = [
                    '$', '¢', '£', '¤', '¥', '֏', '؋', '₠', '₡', '₢',
                    '₣', '₤', '₥', '₦', '₧', '₨', '₩', '₪', '₫', '€',
                    '₭', '₮', '₯', '₰', '₱', '₲', '₳', '₴', '₵', '₶',
                    '₷', '₸', '₹', '₺', '₻', '₼', '₽', '₾', '₿', '꠸',
                    '﷼', '﹩', '＄', '￠', '￡', '￥', '￦', '𑿝', '𑿞', '𑿟',
                    '𑿠', '𞋿', '𞲰'
                ];
                
                content = '<div class="special-char-grid">';
                currency.forEach(char => {
                    content += `<div class="special-char-item" data-char="${char}">${char}</div>`;
                });
                content += '</div>';
                break;
        }
        
        emojiContent.innerHTML = content;
        
        const charItems = document.querySelectorAll('.emoji-item, .special-char-item');
        charItems.forEach(item => {
            item.addEventListener('click', () => {
                const char = item.dataset.char;
                this.insertCharAtCursor(char);
            });
        });
    }
    
    insertCharAtCursor(char) {
        if (this.savedRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedRange);
        }
        
        const selection = window.getSelection();
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            
            if (!range.collapsed) {
                range.deleteContents();
            }
            
            const textNode = document.createTextNode(char);
            range.insertNode(textNode);
            
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
            
            this.undoStack.push(this.notepad.innerHTML);
            this.redoStack = [];
            
            this.checkForChanges();
        }
        
        const backdrop = document.querySelector('.emoji-backdrop');
        const modal = document.querySelector('.emoji-modal');
        if (backdrop && modal) {
            document.body.removeChild(backdrop);
            document.body.removeChild(modal);
        }
        
        this.notepad.focus();
    }

    showLinkDialog() {
        this.saveSelection();
        
        // Check if there's no valid selection or if the selection is outside the notepad
        if (!this.savedRange || !this.notepad.contains(this.savedRange.commonAncestorContainer)) {
            this.createToast('Please select a location inside the notepad to insert a link.', 'warning');
            this.notepad.focus();
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'save-modal';
        modal.innerHTML = `
            <div class="save-modal-content link-modal">
                <h3>Insert Link</h3>
                <div class="link-form">
                    <div class="form-group">
                        <label for="link-text">Link Text</label>
                        <input type="text" id="link-text" placeholder="Display text for the link">
                    </div>
                    <div class="form-group">
                        <label for="link-url">URL</label>
                        <input type="text" id="link-url" placeholder="https://example.com">
                    </div>
                </div>
                <div class="save-modal-buttons">
                    <button id="insert-link-btn">Insert Link</button>
                    <button id="cancel-link-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('link-text').focus();
        
        if (this.savedRange && !this.savedRange.collapsed) {
            const selectedText = this.savedRange.toString();
            document.getElementById('link-text').value = selectedText;
        }
        
        document.getElementById('insert-link-btn').addEventListener('click', () => {
            const linkText = document.getElementById('link-text').value.trim();
            let linkUrl = document.getElementById('link-url').value.trim();
            
            if (linkUrl && !linkUrl.match(/^[a-zA-Z]+:\/\//)) {
                linkUrl = 'http://' + linkUrl;
            }
            
            if (linkText && linkUrl) {
                this.insertLink(linkText, linkUrl);
                document.body.removeChild(modal);
            } else {
                document.getElementById('link-text').classList.add('error');
                document.getElementById('link-url').classList.add('error');
            }
        });
        
        document.getElementById('cancel-link-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }
    
    insertLink(text, url) {
        if (this.savedRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedRange);
            
            const link = document.createElement('a');
            link.href = url;
            link.textContent = text;
            link.target = '_blank'; 
            link.rel = 'noopener noreferrer'; 
            link.dataset.dynamicLink = 'true'; 
            
            if (!this.savedRange.collapsed) {
                this.savedRange.deleteContents();
            }
            
            this.savedRange.insertNode(link);
            
            const newRange = document.createRange();
            newRange.setStartAfter(link);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.undoStack.push(this.notepad.innerHTML);
            this.redoStack = [];
            this.checkForChanges();
            
            this.notepad.focus();
        }
    }
    
    modifyOrRemoveLink(linkElement) {
        const modal = document.createElement('div');
        modal.className = 'save-modal';
        modal.innerHTML = `
            <div class="save-modal-content link-modal">
                <h3>Modify Link</h3>
                <div class="link-form">
                    <div class="form-group">
                        <label for="link-text">Link Text</label>
                        <input type="text" id="link-text" value="${linkElement.textContent}" placeholder="Display text for the link">
                    </div>
                    <div class="form-group">
                        <label for="link-url">URL</label>
                        <input type="text" id="link-url" value="${linkElement.href}" placeholder="https://example.com">
                    </div>
                </div>
                <div class="save-modal-buttons">
                    <button id="update-link-btn">Update Link</button>
                    <button id="remove-link-btn">Remove Link</button>
                    <button id="cancel-link-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('link-text').focus();
        
        document.getElementById('update-link-btn').addEventListener('click', () => {
            const linkText = document.getElementById('link-text').value.trim();
            let linkUrl = document.getElementById('link-url').value.trim();
            
            if (linkUrl && !linkUrl.match(/^[a-zA-Z]+:\/\//)) {
                linkUrl = 'http://' + linkUrl;
            }
            
            if (linkText && linkUrl) {
                linkElement.textContent = linkText;
                linkElement.href = linkUrl;
                this.undoStack.push(this.notepad.innerHTML);
                this.redoStack = [];
                this.checkForChanges();
                document.body.removeChild(modal);
                this.notepad.focus();
            } else {
                document.getElementById('link-text').classList.add('error');
                document.getElementById('link-url').classList.add('error');
            }
        });
        
        document.getElementById('remove-link-btn').addEventListener('click', () => {
            linkElement.remove();
            this.undoStack.push(this.notepad.innerHTML);
            this.redoStack = [];
            this.checkForChanges();
            document.body.removeChild(modal);
            this.notepad.focus();
        });
        
        document.getElementById('cancel-link-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            this.notepad.focus();
        });
    }
    
    showImageDialog() {
        this.saveSelection();
        
        // Check if there's no valid selection or if the selection is outside the notepad
        if (!this.savedRange || !this.notepad.contains(this.savedRange.commonAncestorContainer)) {
            this.createToast('Please select a location inside the notepad to insert an image.', 'warning');
            this.notepad.focus();
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'save-modal';
        modal.innerHTML = `
            <div class="save-modal-content image-modal">
                <h3>Insert Image</h3>
                <div class="image-form">
                    <div class="form-group">
                        <label for="image-url">Image URL</label>
                        <input type="text" id="image-url" placeholder="https://example.com/image.jpg">
                    </div>
                    <div class="form-group">
                        <label>Or Upload From Computer</label>
                        <input type="file" id="image-file" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label for="image-alt">Alt Text (Description)</label>
                        <input type="text" id="image-alt" placeholder="Image description">
                    </div>
                </div>
                <div class="save-modal-buttons">
                    <button id="insert-image-btn">Insert Image</button>
                    <button id="cancel-image-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('image-url').focus();
        
        document.getElementById('insert-image-btn').addEventListener('click', () => {
            const imageUrl = document.getElementById('image-url').value.trim();
            const imageFile = document.getElementById('image-file').files[0];
            const imageAlt = document.getElementById('image-alt').value.trim() || 'Image';
            
            if (imageUrl) {
                this.insertImage(imageUrl, imageAlt);
                document.body.removeChild(modal);
            } else if (imageFile) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.insertImage(e.target.result, imageAlt);
                    document.body.removeChild(modal);
                };
                reader.readAsDataURL(imageFile);
            } else {
                document.getElementById('image-url').classList.add('error');
                document.getElementById('image-file').classList.add('error');
            }
        });
        
        document.getElementById('cancel-image-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }
    
    insertImage(url, alt) {
        if (this.savedRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedRange);
            
            const img = document.createElement('img');
            img.src = url;
            img.alt = alt;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            
            if (!this.savedRange.collapsed) {
                this.savedRange.deleteContents();
            }
            
            this.savedRange.insertNode(img);
            
            const newRange = document.createRange();
            newRange.setStartAfter(img);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.undoStack.push(this.notepad.innerHTML);
            this.redoStack = [];
            this.checkForChanges();
            
            this.notepad.focus();
        } else {
            // If no range is saved, insert at the end of the notepad
            const img = document.createElement('img');
            img.src = url;
            img.alt = alt;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            
            this.notepad.appendChild(img);
            
            // Create a new range after the image
            const selection = window.getSelection();
            const range = document.createRange();
            range.setStartAfter(img);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            
            this.undoStack.push(this.notepad.innerHTML);
            this.redoStack = [];
            this.checkForChanges();
            
            this.notepad.focus();
        }
    }

    importFile() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.txt,.html,.md,.rtf,.docx';
        
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) {
                document.body.removeChild(fileInput);
                return;
            }
            
            if (this.hasUnsavedChanges) {
                this.showSaveDialog(() => {
                    this.processImportedFile(file);
                });
            } else {
                this.processImportedFile(file);
            }
        }, { once: true });
        
        fileInput.click();
    }
    
    processImportedFile(file) {
        const reader = new FileReader();
        
        if (file.name.toLowerCase().endsWith('.docx')) {
            this.readDocxFile(file);
            return;
        }
        
        reader.onload = (e) => {
            const content = e.target.result;
            
            this.notepad.innerHTML = content;
            this.savedContent = content;
            this.currentNoteId = null; 
            this.hasUnsavedChanges = true; 
            this.updateStats();
            this.undoStack = [content];
            this.redoStack = [];
            
            this.createToast(`File "${file.name}" opened successfully!`, 'success');
        };
        
        reader.onerror = () => {
            this.createToast('Error reading file. Please try again.', 'error');
        };
        
        reader.readAsText(file);
    }

    readDocxFile(file) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.21/mammoth.browser.min.js';
        document.body.appendChild(script);
        
        script.onload = () => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const arrayBuffer = e.target.result;
                
                mammoth.convertToHtml({arrayBuffer})
                    .then(result => {
                        this.notepad.innerHTML = result.value;
                        this.savedContent = result.value;
                        this.currentNoteId = null;
                        this.hasUnsavedChanges = true;
                        this.updateStats();
                        this.undoStack = [result.value];
                        this.redoStack = [];
                        
                        this.createToast(`File "${file.name}" opened successfully!`, 'success');
                    })
                    .catch(error => {
                        this.createToast('Error parsing Word document. Please try another file.', 'error');
                        console.error(error);
                    })
                    .finally(() => {
                        document.body.removeChild(script);
                    });
            };
            
            reader.onerror = () => {
                this.createToast('Error reading file. Please try again.', 'error');
                document.body.removeChild(script);
            };
            
            reader.readAsArrayBuffer(file);
        };
        
        script.onerror = () => {
            this.createToast('Failed to load Word document parser. Please check your internet connection.', 'error');
            document.body.removeChild(script);
        };
    }

    initAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            if (this.hasUnsavedChanges) {
                // Save current selection before auto-saving
                this.saveSelection();
                
                this.saveNote();
                this.createToast('Auto-saved', 'success');
                
                // Restore selection after auto-saving
                this.restoreSelection();
            }
        }, 10000); // Auto-save every 10 seconds
    }

    printNote() {
        // Create an iframe to handle printing without affecting the main document
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        // Get the document from the iframe
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        
        // Write the necessary HTML content to the iframe
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Notepad Print</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap');
                    body {
                        font-family: ${this.notepad.style.fontFamily || 'Inter, sans-serif'};
                        font-size: ${this.notepad.style.fontSize || '19px'};
                        line-height: 1.6;
                        color: #333;
                        padding: 20px;
                        white-space: pre-wrap;
                    }
                    p { margin: 0.5em 0; }
                    a { color: #6366f1; text-decoration: underline; }
                    * { box-sizing: border-box; }
                </style>
            </head>
            <body>
                ${this.notepad.innerHTML}
            </body>
            </html>
        `);
        doc.close();
        
        // Wait for the iframe to load content before printing
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            
            // Remove the iframe after printing
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 500);
        }, 300);
    }
}

new NotepadApp();
