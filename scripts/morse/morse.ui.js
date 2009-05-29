Morse.Ui = {};

Morse.Ui.Sound = function() {
    var self = this;
    this.channel = null;
    this.playing = false;

    this.play = function() {
        if (this.playing) {
            return;
        }
        this.playing = true;
        var req = new air.URLRequest('/../sounds/d.mp3');
        var sound = new air.Sound(req);
        self.channel = sound.play();
        setTimeout(this.stop, 5000);
    };

    this.stop = function() {
        this.playing = false;
        self.channel.stop();
    };

};

Morse.Ui.Menu = function(core) {
    var self = this;
    this.accountMapping = new Array();
    this.core = core;
    this.menu = new air.NativeMenu();
    var item = new air.NativeMenuItem('No accounts');
    item.enabled = false;
    this.menu.addItem(item);
    this.menu.addItem(new air.NativeMenuItem('', true));
    var command = this.menu.addItem(new air.NativeMenuItem('Refresh'));
    command.addEventListener(air.Event.SELECT, function(evt){
        self.core.refreshChecking();
    });

    self.menu.addItem(new air.NativeMenuItem('', true));
    command = self.menu.addItem(new air.NativeMenuItem('Exit'));
    command.addEventListener(air.Event.SELECT,function(event){
        air.NativeApplication.nativeApplication.icon.bitmaps = [];
        air.NativeApplication.nativeApplication.exit();
    });

};

    Morse.Ui.Menu.prototype.addAllAccounts = function() {
        var accounts = this.core.accounts;
        if (!accounts || accounts.length == 0) {
            return;
        }
        for (var i = 0; i < accounts.length; ++i) {
            this.addAccount(accounts[i]);
        }
    };

    Morse.Ui.Menu.prototype.addAccount = function(account) {
        if (this.accountMapping.length == 0) {
            this.menu.removeItemAt(0);
        }
        var label = account.name + ' (' + (account.nrItems >= 0 ? account.nrItems : 'x') + ')';
        var item = new air.NativeMenuItem(label);
        item.enabled = !account.ignoreNewMessages;
        var command = this.menu.addItemAt(item, 0);
        command.addEventListener(air.Event.SELECT, function(evt) {
            account.goToInbox();
        });
        this.accountMapping.unshift(account.id);
    };

    Morse.Ui.Menu.prototype.updateAccount = function(account) {
        for (var i = 0; i < this.accountMapping.length; ++i) {
            if (this.accountMapping[i] == account.id) {
                var item = this.menu.getItemAt(i);
                item.label = account.name + (account.ignoreNewMessages ? '' : ' (' + account.nrItems + ')');
                item.enabled = !account.ignoreNewMessages;
                return;
            }
        }
    };

    Morse.Ui.Menu.prototype.enableAccount = function(account, enable) {
        var menuIndex = this.findAccountMenuIndex(account);
        if (menuIndex < 0) {
            return;
        }
        this.menu.getItemAt(menuIndex).enabled = enable;
    };

    Morse.Ui.Menu.prototype.removeAccount = function(account) {
        for (var i = 0; i < this.accountMapping.length; ++i) {
            if (this.accountMapping[i] == account.id) {
                this.menu.removeItemAt(i);
                this.accountMapping.splice(i, 1);
                if (this.accountMapping.length == 0) {
                    var item = new air.NativeMenuItem('No accounts');
                    item.enabled = false;
                    this.menu.addItem(item);
                }
                return;
            }
        }
    };

    Morse.Ui.Menu.prototype.findAccountMenuIndex = function(account) {
        for (var i = 0; i < this.accountMapping.length; ++i) {
            if (this.accountMapping[i] == account.id) {
                return i;
            }
        }
        return -1;
    };

Morse.Ui.Icon = function(path, onLoadCallback) {

    this.bitmaps = null;
    this.tempBitmap16 = null;
    this.tempBitmap32 = null;
    this.tempBitmap48 = null;
    this.tempBitmap128 = null;
    this.onLoadCallback = onLoadCallback;

    var self = this;

    this.prepare = function() {
        if (self.tempBitmap16 && self.tempBitmap32 && self.tempBitmap48 && self.tempBitmap128) {
            self.bitmaps = new runtime.Array(self.tempBitmap16, self.tempBitmap32, self.tempBitmap48, self.tempBitmap128);
            self.tempBitmap16 = null;
            self.tempBitmap32 = null;
            self.tempBitmap48 = null;
            self.tempBitmap128 = null;
            if (self.onLoadCallback) {
                self.onLoadCallback(self);
            }
        }
    };

    this.load = function(path, size) {
        var loader = new air.Loader();
        loader.contentLoaderInfo.addEventListener(air.Event.COMPLETE, function(evt) {
            self['tempBitmap' + size] = evt.target.content.bitmapData;
            self.prepare();
        });
        loader.load(new air.URLRequest(path + '-' + size + '.png'));
    };

    this.load(path, 16);
    this.load(path, 32);
    this.load(path, 48);
    this.load(path, 128);

};


Morse.Ui.Window = function(core) {
    this.core = core;
    this.isMouseOnAccount = false;
};

    Morse.Ui.Window.prototype.init = function() {
        air.trace('Initializing window');
        var self = this;
        $('#add a').click(function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            self.removeForm();
            self.showAccountForm();
        });
        $('#preferences a').click(function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            self.removeForm();
            self.showOptionsForm();
        });
        $(window).mousedown(function(evt) {
            if ($(evt.target).is('input')) {
                return;
            }
            if (!self.isMouseOnAccount) {
                nativeWindow.startMove();
            }
        });
        $('#resizer').mousedown(function(evt) {
            evt.stopPropagation();
            nativeWindow.startResize(air.NativeWindowResize.BOTTOM_RIGHT);
        });
        var bounds = Morse.Storage.getWindowBounds();
        if (bounds) {
            nativeWindow.bounds = bounds;
        }
        nativeWindow.alwaysInFront = Morse.Options.alwaysOnTop;
        nativeWindow.addEventListener(air.NativeWindowBoundsEvent.MOVE, function(evt) {
            Morse.Storage.updateWindowBounds(evt.afterBounds);
        });
        nativeWindow.addEventListener(air.NativeWindowBoundsEvent.RESIZING, function(evt) {
            var height = $(document.body).height();
            if (height + 16 > evt.afterBounds.height) {
                evt.preventDefault();
            }
        });
    };

    Morse.Ui.Window.prototype.pack = function() {
        var container = $(document.body);
        var height = container.height();
        var width = container.width();
        var bounds = nativeWindow.bounds;
        nativeWindow.bounds = new air.Rectangle(bounds.x, bounds.y, width, height + 16);
    };

    Morse.Ui.Window.prototype.showAccounts = function() {
        air.trace('Showing accounts');
        $('#menu').show();
        var accounts = this.core.accounts;
        if (accounts && accounts.length > 0) {
            $('#accounts').remove();
            $('#container').prepend('<ol id="accounts"></ol>');
            for (var i = 0; i < accounts.length; ++i) {
                this.addAccount(accounts[i]);
            }
            var self = this;

        }
        $('#loading').remove();
        this.pack();
    };

    Morse.Ui.Window.prototype.showOptionsForm = function() {
        this.removeForm();
        $('#loading').remove();
        $('#menu').hide();
        var html = '<form action="#" method="post" id="preferences">'
            + '<fieldset><legend>Preferences</legend><h1>Preferences</h1>'
            + '<div><input type="checkbox" name="minimize-to-tray" id="f-minimize-to-tray" ' + (Morse.Options.minimizeToTray ? 'checked="checked"' : '') + '> <label for="f-minimize-to-tray">Minimize to tray</label></div>'
            + '<div><input type="checkbox" name="play-sound" id="f-play-sound"' + (Morse.Options.playSound ? ' checked="checked"' : '') + '> <label for="f-play-sound">Play sound</label></div>'
            + '<div><input type="checkbox" name="always-on-top" id="f-always-on-top"' + (Morse.Options.alwaysOnTop ? ' checked="checked"' : '') + '> <label for="f-always-on-top">Keep window in front</label></div>'
            + '<div class="actions"><button>Save</button> or <a href="#" id="cancel">cancel</a></div>'
            + '</fieldset>'
            + '</form>';
        $('#container').prepend(html);
        var self = this;
        $('form').submit(function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            self.onOptionsFormSubmit();
        });
        $('#cancel').click(function() {
            self.removeForm();
        });
        this.pack();
    };

    Morse.Ui.Window.prototype.onOptionsFormSubmit = function() {
        Morse.Options.minimizeToTray = ($("input[name='minimize-to-tray']:checked").length > 0);
        Morse.Options.playSound = ($("input[name='play-sound']:checked").length > 0);
        Morse.Options.alwaysOnTop = ($("input[name='always-on-top']:checked").length > 0);
        nativeWindow.alwaysInFront = Morse.Options.alwaysOnTop;
        Morse.Options.save();
        this.removeForm();
    };

    Morse.Ui.Window.prototype.onCounterClick = function(evt) {
        var listItem = $(evt.target);
        while (!listItem.is('li')) {
            listItem = listItem.parent();
        }
        this.removeForm();
        var id = listItem.attr('id').replace('account-', '');
        air.trace('Click on counter for id', id);
        listItem.after('<li id="form-holder"></li>');
        this.showResetCounterForm(this.core.getAccount(id), $('#form-holder'));
    };

    Morse.Ui.Window.prototype.pad = function(str, desiredLength, paddingValue, leftSide) {
        var padded = '' + (str ? str : '');
        var padding = '' + paddingValue;
        var paddingLength = padding.length;
        for (var i = padded.length; i < desiredLength; i += paddingLength) {
            if (leftSide) {
                padded = padding + padded;
            } else {
                padded = padded + padding;
            }
        }
        return padded;
    }

    Morse.Ui.Window.prototype.showResetCounterForm = function(account, hook) {
        air.trace('Showing reset counter form');
        $('#loading').remove();
        $('#account-' + account.id).addClass('active');

        var self = this;
        var html = '<form action="#" method="post">'
            + '<fieldset><legend>Account</legend>'
            + '<div><label class="tick" for="f-ignore-0"><input type="radio" name="ignore" id="f-ignore-0" ' + (account.ignoreNewMessages ? 'checked="checked"' : '') + ' value="0">Ignore all new messages</label></div>'
            + '<div><label class="tick" for="f-ignore-1"><input type="radio" name="ignore" id="f-ignore-1" value="1">Ignore messages received up till now</label></div>';
        if (account.ignoreEntriesOlderThan) {
            var padder = function(nr) {
                return self.pad(nr, 2, '0', true);
            };
            var date = new Date(account.ignoreEntriesOlderThan);
            var dateString = date.getFullYear() + '/' + padder(date.getMonth()) + '/' + padder(date.getDate()) + ' ' + padder(date.getHours()) + ':' + padder(date.getMinutes());
            html += '<div><label class="tick" for="f-ignore-2"><input type="radio" name="ignore" id="f-ignore-2" checked="checked" value="2">Ignore messages received before ' + dateString + '</label></div>';
        }
        html += '<div><label class="tick" for="f-ignore-3"><input type="radio" name="ignore" id="f-ignore-3" ' + ((account.ignoreNewMessages || account.ignoreEntriesOlderThan) ? '' : 'checked="checked"') + ' value="3">Do not ignore messages</label></div>'
            + '<input type="hidden" name="id" value="' + account.id + '">'
            + '<div class="actions"><button>Save</button> or <a href="#" id="cancel">cancel</a></div>'
            + '</fieldset>'
            + '</form>';
        hook.append(html);
        $('form').submit(function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            self.onResetCounterFormSubmit();
        });
        $('#cancel').click(function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            self.removeForm();
        });
        this.pack();
    };

    Morse.Ui.Window.prototype.onResetCounterFormSubmit = function() {
        var id = $("input[name='id']").val();
        var value = $("input[name='ignore']:checked").val();
        var ignoreAll = false;
        var ignoreFromNowOn = false;
        if (value != '2') {
            if (value == '0') {
                ignoreAll = true;
            } else if (value == '1') {
                ignoreFromNowOn = true;
            }
            this.core.resetCounter(id, ignoreAll, ignoreFromNowOn);
        }
        this.removeForm();
    };

    Morse.Ui.Window.prototype.showAccountForm = function(account, hook, excludeCancel) {
        air.trace('Showing account form for', account);
        $('#loading').remove();
        if (account) {
            $('#account-' + account.id).addClass('active');
        }

        var html = '<form action="#" id="' + (account ? 'account' : 'add-account') + '" method="post">'
            + '<fieldset><legend>Account</legend>';
        if (!account) {
            html += '<h1>Add an account</h1>';
        }
        html += '<div>'
            + '<label for="f-username">Username:</label>'
            + '<div><input type="text" name="username" id="f-username" value="' + (account ? account.username : '') + '"></div>'
            + '</div><div>'
            + '<label for="f-password">Password:</label>'
            + '<div><input type="password" name="password" id="f-password" value="' + (account ? account.password : '') + '"></div>'
            + '</div><div>'
            + '<label for="f-name">Name:</label>'
            + '<div><input type="text" name="name" id="f-name" value="' + (account ? account.name : '') + '"></div>'
            + '</div><div class="actions">'
            + (account ? '<input type="hidden" name="id" value="' + account.id + '">' : '')
            + '<button>' + (account ? 'Edit' : 'Add') + '</button>' + (excludeCancel ? '' : ' or <a href="#" id="cancel">cancel</a>') + (account ? '<a href="#" id="delete">delete</a>' : '');
            + '</div></fieldset>'
            + '</form>';
        if (hook) {
            hook.append(html);
        } else {
            $('#container').prepend(html);
        }
        var self = this;
        $('form').submit(function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            self.onFormSubmit();
        });
        $('#cancel').click(function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            self.removeForm();
        });
        $('#delete').click(function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            self.onRequestDelete();
        });
        this.pack();
    };

    Morse.Ui.Window.prototype.updateUnreadMail = function(account) {
        var nrUnread = (account.nrItems >= 0 ? account.nrItems : 'x');
        var nr = $('#account-' + account.id + ' .nr');
        nr.text(nrUnread);
        if (account.nrItems > 0) {
            nr.addClass('new');
        } else {
            nr.removeClass('new');
        }
    };

    Morse.Ui.Window.prototype.addAccount = function(account) {
        if ($('#accounts').length == 0) {
            $('#container').prepend('<ol id="accounts"></ol>');
        }
        $('#accounts').append('<li id="account-' + account.id + '" class="' + (account.ignoreNewMessages ? ' disabled' : '') + '"><a href="#" class="toggle">&nbsp;</a><span class="name">' + account.name + '</span><span class="nr ' + (account.nrItems > 0 ? ' new' : '') + '">' + (account.nrItems < 0 ? 'x' : account.nrItems) + '</span></li>');
        var item = $('#account-' + account.id);
        var self = this;
        item.mousedown(function() {
            self.isMouseOnAccount = true;
            var account = self.core.getAccount($(this).attr('id').replace('account-', ''));
            if (account) {
                account.goToInbox();
            }
        });
        item.mouseup(function() {
            self.isMouseOnAccount = false;
        });
        var toggle = item.find('.toggle');
        toggle.mousedown(function(evt) {
            self.isMouseOnAccount = true;
            evt.preventDefault();
            evt.stopPropagation();
            if (self.isEditAccountFormShowing(evt)) {                
                self.removeForm();
            } else {            
                self.onEditAccount(evt);
            }
        });
        toggle.mouseout(function(evt) {
            self.isMouseOnAccount = false;
        });
        var nr = item.find('.nr');
        nr.mousedown(function(evt) {
            self.isMouseOnAccount = true;
            evt.preventDefault();
            evt.stopPropagation();
            self.onCounterClick(evt);
        });
        nr.mouseout(function(evt) {
            self.isMouseOnAccount = false;
        });
        this.pack();
    };
    
    Morse.Ui.Window.prototype.isEditAccountFormShowing = function(evt) {
        var listItem = $(evt.target);
        while (!listItem.is('li')) {
            listItem = listItem.parent();
        }
        return listItem.next().is('#form-holder');
    };

    Morse.Ui.Window.prototype.updateAccount = function(account) {
        var item = $('li#account-' + account.id);
        item.contents().unbind();
        if (account.ignoreNewMessages) {
            item.addClass('disabled');
        } else {
            item.removeClass('disabled');
        }
        item.html('<a href="#" class="toggle">&nbsp;</a><span class="name">' + account.name + '</span><span class="nr ' + (account.nrItems > 0 ? ' new' : '') + '">' + (account.nrItems < 0 ? 'x' : account.nrItems) + '</span>');
        var self = this;
        var toggle = item.find('.toggle');
        toggle.mousedown(function(evt) {
            self.isMouseOnAccount = true;
            evt.preventDefault();
            evt.stopPropagation();
            self.onEditAccount(evt);
        });
        toggle.mouseout(function(evt) {
            self.isMouseOnAccount = false;
        });
        var nr = item.find('.nr');
        nr.mousedown(function(evt) {
            self.isMouseOnAccount = true;
            evt.preventDefault();
            evt.stopPropagation();
            self.onCounterClick(evt);
        });
        nr.mouseout(function(evt) {
            self.isMouseOnAccount = false;
        });
    };

    Morse.Ui.Window.prototype.removeAccount = function(account) {
        var item = $('li#account-' + account.id);
        item.contents().unbind();
        item.unbind();
        item.remove();
    };

    Morse.Ui.Window.prototype.onEditAccount = function(evt) {
        this.removeForm();
        var listItem = $(evt.target);
        while (!listItem.is('li')) {
            listItem = listItem.parent();
        }
        var id = listItem.attr('id').replace('account-', '');
        listItem.after('<li id="form-holder"></li>');
        this.showAccountForm(this.core.getAccount(id), $('#form-holder'));
    };

    Morse.Ui.Window.prototype.onFormSubmit = function() {
        $('form').before('<div id="testing" class="status">Testing...</div>');
        $('form').hide();
        var username = $("input[name='username']").val();
        var password = $("input[name='password']").val();
        var name = $("input[name='name']").val();
        var id = $("input[name='id']").val();
        var account = new Morse.Account(username, password, name, id);
        var self = this;
        this.core.saveAccount(account,
            function() {
                $('#testing').remove();
                self.removeForm();
            },
            function() {
                $('form .message').remove();
                var message = '<div class="message error">Please correct your username and/or password</div>';
                var hook = $('form h1');
                if (hook.length > 0) {
                    hook.after(message);
                } else {
                    $('form').prepend(message);
                }
                $('form').show();
                $('#testing').remove();
                self.pack();
            }
        );
    };

    Morse.Ui.Window.prototype.onRequestDelete = function() {
        var form = $('form');
        form.contents().unbind();
        form.unbind();
        var id= $("input[name='id']").val();
        form.html('<fieldset><legend>Confirm delete</legend><div>Are you sure you want to delete this account?</div><div class="actions"><input type="hidden" name="id" value="' + id + '"><button id="confirm">Yes</button> or <a href="#" id="cancel">cancel</a></div></fieldset>');
        var self = this;
        form.submit(function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            self.onDeleteConfirmed();
        });
        $('#cancel').click(function() {
            self.removeForm();
        });
    };

    Morse.Ui.Window.prototype.onDeleteConfirmed = function() {
        var id = $("input[name='id']").val();
        var self = this;
        this.core.deleteAccount(this.core.getAccount(id),
            function() {
                self.removeForm();
                if (self.core.accounts.length == 0) {
                    self.showAccountForm();
                }
            }
        );
    };

    Morse.Ui.Window.prototype.removeForm = function() {
        var form = $('form');
        $('#form-holder').remove();
        form.contents().unbind();
        form.unbind();
        form.remove();
        $('.active').removeClass('active');
        $('#menu').show();
        this.pack();
    };
    
    Morse.Ui.Window.prototype.setTooltip = function(str) {
        if (air.NativeApplication.supportsSystemTrayIcon) {
            air.NativeApplication.nativeApplication.icon.tooltip = str;
        }
    };