 Morse.Storage = {};

    Morse.Storage.loadAccount = function(id) {
        var storedValue = air.EncryptedLocalStore.getItem('account.' + id);
        if (storedValue) {
            var account_id = parseInt(storedValue.readUTF());
            var name = storedValue.readUTF();
            var username = storedValue.readUTF();
            var password = storedValue.readUTF();
            var account = new Morse.Account(username, password, name, account_id);
            if (storedValue.bytesAvailable > 0) {
                account.ignoreNewMessages = ('1' == storedValue.readUTF());
                account.ignoreEntriesOlderThan = parseInt(storedValue.readUTF());
            }
            return account;
        }
        return null;
    };

    Morse.Storage.storeAccount = function(account) {
        if (!account.id) {
            account.id = Morse.Storage.getNewAccountId();
        }
        var bytes = new air.ByteArray();
        bytes.writeUTF(account.id);
        bytes.writeUTF(account.name);
        bytes.writeUTF(account.username);
        bytes.writeUTF(account.password);
        bytes.writeUTF(account.ignoreNewMessages ? '1' : '0');
        bytes.writeUTF(account.ignoreEntriesOlderThan ? account.ignoreEntriesOlderThan : '0');
        air.EncryptedLocalStore.setItem('account.' + account.id, bytes);
    };

    Morse.Storage.removeAccount = function(account) {
        var store = Morse.Storage;
        var ids = store.getAccountIds();
        var index = $.inArray(account.id, ids);
        if (index >= 0) {
            ids.splice(index, 1);
            store.updateAccountIds(ids);
        }
        air.EncryptedLocalStore.removeItem('account.' + account.id);
    };

    Morse.Storage.loadAllAccounts = function() {
        var allIds = Morse.Storage.getAccountIds();
        var accounts = new Array();
        for (var i = 0; i < allIds.length; ++i) {
            var account = Morse.Storage.loadAccount(allIds[i]);
            if (!account) {
                allIds.splice(i, 1);
                --i;
                Morse.Storage.updateAccountIds(allIds);
            } else {
                accounts.push(account);
            }
        }
        return accounts;
    };

    Morse.Storage.getAccountIds = function() {
        var storedValue = air.EncryptedLocalStore.getItem('account.ids');
        var ids = new Array();
        if (storedValue) {
            while (storedValue.bytesAvailable > 0) {
                var id = parseInt(storedValue.readUTF());
                ids.push(id);
                air.trace('ID = ' + id);
            }
        }
        return ids;
    };

    Morse.Storage.getNewAccountId = function() {
        var ids = Morse.Storage.getAccountIds();
        var newId = 1;
        if (ids && ids.length > 0) {
            newId = ids[ids.length - 1] + 1;
        }
        ids.push(newId);
        Morse.Storage.updateAccountIds(ids);
        return newId;
    };

    Morse.Storage.updateAccountIds = function(ids) {
        var bytes = new air.ByteArray();
        for (var i = 0; i < ids.length; ++i) {
            bytes.writeUTF(ids[i]); // writeInt writes 4 bytes, readInt only sees 1 byte
        }
        air.EncryptedLocalStore.setItem('account.ids', bytes);
        return ids;
    };

    Morse.Storage.updateWindowBounds = function(bounds) {
        var bytes = new air.ByteArray();
        bytes.writeUTF(bounds.x);
        bytes.writeUTF(bounds.y);
        bytes.writeUTF(bounds.width);
        bytes.writeUTF(bounds.height);
        air.EncryptedLocalStore.setItem('window.bounds', bytes);
        return bounds;
    };

    Morse.Storage.getWindowBounds = function() {
        var storedValue = air.EncryptedLocalStore.getItem('window.bounds');
        if (!storedValue) {
            return null;
        }
        var bounds = new air.Rectangle();
        bounds.x = parseInt(storedValue.readUTF());
        bounds.y = parseInt(storedValue.readUTF());
        bounds.width = parseInt(storedValue.readUTF());
        bounds.height = parseInt(storedValue.readUTF());
        return bounds;
    };

    Morse.Storage.save = function(key, val) {
        var bytes = new air.ByteArray();
        bytes.writeUTF(val);
        air.EncryptedLocalStore.setItem(key, bytes);
    };

    Morse.Storage.load = function(key) {
        var storedValue = air.EncryptedLocalStore.getItem(key);
        if (!storedValue) {
            return null;
        }
        return storedValue.readUTF();
    };