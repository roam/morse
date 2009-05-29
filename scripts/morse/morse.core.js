var Morse = {};

Morse.Options = {};
    Morse.Options.minimizeToTray = true;
    Morse.Options.playSound = true;
    Morse.Options.alwaysOnTop = false;

    Morse.Options.load = function() {
        var value = Morse.Storage.load('morse.options.minimizeToTray');
        Morse.Options.minimizeToTray = (value == null || value == '1');
        value = Morse.Storage.load('morse.options.playSound');
        Morse.Options.playSound = (value == null || value == '1');
        value = Morse.Storage.load('morse.options.alwaysOnTop');
        Morse.Options.alwaysOnTop = (value == '1');
    };

    Morse.Options.save = function() {
        Morse.Storage.save('morse.options.minimizeToTray', Morse.Options.minimizeToTray ? '1' : '0');
        Morse.Storage.save('morse.options.playSound', Morse.Options.playSound ? '1' : '0');
        Morse.Storage.save('morse.options.alwaysOnTop', Morse.Options.alwaysOnTop ? '1' : '0');
    };

Morse.Core = function(checkInterval) {
    this.checkInterval = checkInterval || 120000;
    this.accounts = null;
    this.accountChecking = new Array();
    this.unreadMailIdSet = new Array();
    this.window = null;
    this.menu = null;
    this.timer = null;
    this.normalIcon = null;
    this.newMailIcon = null;
    var self = this;

    this.onAccountCheckComplete = function(feed, account) {
        air.trace('Account check complete for', account);
        var parser = new Morse.Gmail.Feed.Parser();
        parser.parse(feed, account.ignoreEntriesOlderThan);
        var index = self.getAccountIndex(account.id);
        if (index >= 0 && index < self.accountChecking.length) {
            self.accountChecking[index] = false;
        }
        account.nrItems = (parser.entries ? parser.entries.length : 0);
        account.entries = parser.entries;
        self.menu.updateAccount(account);
        self.window.updateUnreadMail(account);
        self.notifyUser();
    };

    this.onAccountCheckError = function(evt, account) {
        self.menu.updateAccount(account);
        self.window.updateUnreadMail(account);
    };

    this.bounce = null;

};

    Morse.Core.prototype.notifyUser = function() {
        if (this.isChecking()) {
            air.trace('Still checking accounts...');
            return;
        }
        var newMail = this.refreshUnreadMailIdSet();
        if (newMail && Morse.Options.playSound) {
            new Morse.Ui.Sound().play();
            this.bounce();
        }
        if (this.unreadMailIdSet.length > 0) {
            air.NativeApplication.nativeApplication.icon.bitmaps = this.newMailIcon.bitmaps;
        } else {
            air.NativeApplication.nativeApplication.icon.bitmaps = this.normalIcon.bitmaps;
        }
        this.updateWindowTitle();
    };

    Morse.Core.prototype.getTotalNrUnreadItems = function() {
        var totalNrUnread = 0;
        for (var i = 0; i < this.accounts.length; ++i) {
            totalNrUnread += this.accounts[i].nrItems;
        }
        return totalNrUnread;
    };

    Morse.Core.prototype.updateWindowTitle = function() {
        var totalNrUnread = this.getTotalNrUnreadItems();
        var text = 'Morse';
        if (totalNrUnread > 0) {
            text += ' (' + totalNrUnread + ' unread)';
        }
        $('title').text(text);
        this.window.setTooltip(text);
    };

    Morse.Core.prototype.refreshUnreadMailIdSet = function() {
        if (this.isChecking()) {
            return false;
        }
        air.trace('Refreshing unread mail id set');
        // First remove all unread mail ids that we can't find in the accounts
        for (var i = 0; i < this.unreadMailIdSet.length; ++i) {
            var found = false;
            for (var j = 0; j < this.accounts.length && !found; ++j) {
                var entries = this.accounts[j].entries;
                if (!entries) {
                    continue;
                }
                for (var k = 0; k < entries.length && !found; ++k) {
                    if (entries[k].id == this.unreadMailIdSet[i]) {
                        found = true;
                    }
                }
            }
            if (!found) {
                this.unreadMailIdSet.splice(i, 1);
                --i;
            }
        }
        var newMail = false;
        // Then push new unread mail ids
        for (var i = 0; i < this.accounts.length; ++i) {
            var account = this.accounts[i];
            air.trace('Pushing new unread mail ids for', account);
            if (account.entries) {
                for (var j = 0; j < account.entries.length; ++j) {
                    var entryId = account.entries[j].id;
                    if ($.inArray(entryId, this.unreadMailIdSet) < 0) {
                        this.unreadMailIdSet.push(entryId);
                        newMail = true;
                    }
                }
            }
        }
        return newMail;
    };

    Morse.Core.prototype.init = function() {
        Morse.Options.load();
        this.window = new Morse.Ui.Window(this);
        this.window.init();
        this.initDock();
        this.accounts = Morse.Storage.loadAllAccounts();
        this.checkAccounts();
        this.startChecking();
        if (this.accounts && this.accounts.length > 0) {
            this.menu.addAllAccounts();
            this.window.showAccounts();
        } else {
            this.window.showAccountForm(null, null, true);
        }
    };

    Morse.Core.prototype.initDock = function() {
        this.menu = new Morse.Ui.Menu(this);
        this.normalIcon = new Morse.Ui.Icon('/images/icons/morse', function(icon) {
            air.NativeApplication.nativeApplication.icon.bitmaps = icon.bitmaps;
        });
        this.newMailIcon = new Morse.Ui.Icon('/images/icons/morse-new');
    
        this.window.setTooltip('Morse');
        air.NativeApplication.nativeApplication.icon.menu = this.menu.menu;

        air.NativeApplication.nativeApplication.icon.addEventListener(window.runtime.flash.events.MouseEvent.CLICK, function() {
            nativeWindow.visible = true;
        });

        nativeWindow.addEventListener(air.NativeWindowDisplayStateEvent.DISPLAY_STATE_CHANGING, function(evt) {
            if (!Morse.Options.minimizeToTray) {
                return;
            }
            if (evt.afterDisplayState == air.NativeWindowDisplayState.MINIMIZED) {
                evt.preventDefault();
                nativeWindow.visible = false;
            }
        });
        if (air.NativeApplication.supportsSystemTrayIcon) {
            this.bounce = function() {
                nativeWindow.notifyUser(air.NotificationType.INFORMATIONAL);
            }
        } else if (air.NativeApplication.supportsDockIcon) {
            var self = this;
            this.bounce = function() {
                air.NativeApplication.nativeApplication.icon.bounce();
            }
        }
    };

    Morse.Core.prototype.checkAccounts = function() {
        if (!this.accounts || this.accounts.length == 0) {
            return;
        }
        air.trace('Checking accounts for unread mail');
        this.accountChecking = new Array(this.accounts.length);
        for (var i = 0; i < this.accounts.length; ++i) {
            var account = this.accounts[i];
            if (account.ignoreNewMessages) {
                air.trace('Ignoring new messages for', account);
                continue;
            }
            air.trace('Checking account', account);
            this.accountChecking[i] = true;
            var loader = new Morse.Gmail.Feed.Loader(account, this.onAccountCheckComplete, this.onAccountCheckError);
            loader.load();
        }
    };

    Morse.Core.prototype.getAccountIndex = function(id) {
        if (!this.accounts || this.accounts.length == 0) {
            return -1;
        }
        for (var i = 0; i < this.accounts.length; ++i) {
            if (this.accounts[i].id == id) {
                return i;
            }
        }
        return -1;
    };

    Morse.Core.prototype.getAccount = function(id) {
        var index = this.getAccountIndex(id);
        if (index < 0) {
            return null;
        }
        return this.accounts[index];
    };

    Morse.Core.prototype.deleteAccount = function(account, onDelete) {
        this.stopChecking();
        Morse.Storage.removeAccount(account);
        this.menu.removeAccount(account);
        this.window.removeAccount(account);
        var index = this.getAccountIndex(account.id);
        this.accounts.splice(index, 1);
        this.accountChecking.splice(index, 1);
        this.startChecking();
        this.checkAccounts();
        onDelete();
    };

    Morse.Core.prototype.saveAccount = function(account, onSave, onSaveError) {
        if (!account.id) {
            return this.createAccount(account, onSave, onSaveError);
        }
        return this.updateAccount(account, onSave, onSaveError);
    };

    Morse.Core.prototype.updateAccount = function(account, onUpdate, onUpdateError) {
        var self = this;
        this.validateAccount(
            account,
            function(data, acc) {
                air.trace(acc, 'is valid. Now storing.');
                var account = self.getAccount(acc.id);
                account.name = acc.name;
                account.username = acc.username;
                account.password = acc.password;
                Morse.Storage.storeAccount(account);
                self.window.updateAccount(account);
                self.menu.updateAccount(account);
                self.refreshChecking();
                onUpdate(acc);
            },
            function(evt, acc) {
                air.trace(acc, 'is invalid');
                onUpdateError(acc);
            }
        );
    };

    Morse.Core.prototype.createAccount = function(account, onCreate, onCreateError) {
        var self = this;
        this.validateAccount(
            account,
            function(data, acc) {
                air.trace(acc, 'is valid. Now storing.');
                Morse.Storage.storeAccount(acc);
                self.accounts.push(acc);
                self.accountChecking.push(false);
                self.window.addAccount(acc);
                self.menu.addAccount(acc);
                self.refreshChecking();
                onCreate(acc);
            },
            function(evt, acc) {
                air.trace(acc, 'is invalid');
                onCreateError(acc);
            }
        );
    };

    Morse.Core.prototype.resetCounter = function(accountId, ignoreAll, ignoreFromNowOn) {
        var account = this.getAccount(accountId);
        if (!account) {
            return;
        }
        if (ignoreAll) {
            account.ignoreNewMessages = true;
            account.entries = null;
            account.nrItems = -1;
            account.ignoreEntriesOlderThan = 0;
        } else if (ignoreFromNowOn) {
            account.ignoreNewMessages = false;
            account.entries = null;
            account.nrItems = -1;
            var date = new Date();
            account.ignoreEntriesOlderThan = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
        } else {
            account.ignoreNewMessages = false;
            account.ignoreEntriesOlderThan = 0;
        }
        Morse.Storage.storeAccount(account);
        this.window.updateAccount(account);
        this.menu.updateAccount(account);
        this.refreshChecking();
    };

    Morse.Core.prototype.validateAccount = function(account, onValid, onInvalid) {
        air.trace('Validating', account);
        var loader = new Morse.Gmail.Feed.Loader(account, onValid, onInvalid);
        loader.load();
        loader = null;
    };

    Morse.Core.prototype.refreshChecking = function() {
        this.stopChecking();
        this.startChecking();
        this.checkAccounts();
    };

    Morse.Core.prototype.startChecking = function() {
        var self = this;
        this.timer = setInterval(function() {
            self.checkAccounts();
        }, this.checkInterval);
    };

    Morse.Core.prototype.stopChecking = function() {
        clearInterval(this.timer);
    };

    Morse.Core.prototype.isChecking = function() {
        return $.inArray(true, this.accountChecking) >= 0;
    };

$(document).ready(function() {
    var morse = new Morse.Core();
    air.trace('Initializing Morse');
    morse.init();
});