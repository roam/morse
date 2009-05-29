Morse.Gmail = {};

Morse.Gmail.Feed = {};

Morse.Gmail.Feed.Entry = function() {
    this.id = null;
    this.title = null;
    this.summary = null;
    this.link = null;
    this.from = null;
    this.replyTo = null;
    this.dateReceived = null;
};

    Morse.Gmail.Feed.Entry.prototype.toString = function() {
        return '{id: ' + this.id + ', title: ' + this.title + ', summary: ' + this.summary + ', from: ' + this.from + ', dateReceived: ' + this.dateReceived + '}';
    };

Morse.Gmail.Feed.Parser = function() {
    this.fullCount = 0;
    this.entries = new Array();
};

    Morse.Gmail.Feed.Parser.prototype.parse = function(xmlToParse, ignoreFromDateUTC) {
        var feed = $('feed', new DOMParser().parseFromString(xmlToParse, 'text/xml'));
        this.fullCount = parseInt(feed.find('fullcount').text());
        var entries = this.entries;
        var offset = new Date().getTimezoneOffset() * 60 * 1000;
        feed.find('entry').each(function(index) {
            var entry = new Morse.Gmail.Feed.Entry();
            var el = $(this);
            //'2008-10-19T12:21:06Z'
            var dateReceivedString = el.find('modified').text();
            dateReceivedString = dateReceivedString.replace('Z', '');
            var dateParts = dateReceivedString.split('T');
            var date = dateParts[0].split('-');
            var time = dateParts[1].split(':');
            entry.dateReceived = Date.UTC(parseInt(date[0]), parseInt(date[1]) - 1, parseInt(date[2]), parseInt(time[0]), parseInt(time[1]), parseInt(time[2]));
            var utc = new Date(ignoreFromDateUTC);
            var dateReceived = new Date(entry.dateReceived);
            if (ignoreFromDateUTC && ignoreFromDateUTC > entry.dateReceived) {
                // Assuming that the entries are ordered by date (descending) we can ignore all other entries
                return false;
            }
            entry.id = el.find('id').text();
            entry.title = el.find('title').text();
            entry.summary = el.find('summary').text();
            entry.link = el.find('link').text();
            entry.from = el.find('author name').text();
            entry.replyTo = el.find('author email').text();
            entries.push(entry);
            return true; // Prevent warnings from Komodo
        });
    };

Morse.Gmail.Feed.Loader = function(account, callbackSuccess, callbackError) {

    var self = this;
    this.account = account;
    this.callbackSuccess = callbackSuccess;
    this.callbackError = callbackError;
    this.urlLoader = new air.URLLoader();

    this.load = function() {
        var authHeader = new air.URLRequestHeader('Authorization', 'Basic ' + btoa(self.account.username + ':' + self.account.password));
        var urlRequest = new air.URLRequest();
        urlRequest.authenticate = false;
        urlRequest.requestHeaders.push(authHeader);
        urlRequest.url = account.getAtomFeedUrl();
        urlRequest.method = air.URLRequestMethod.GET;
        urlRequest.useCache = false;

        self.hookUp();
        self.urlLoader.load(urlRequest);
        authHeader = null;
        urlRequest = null;
    };

    this.hookUp = function() {
        self.urlLoader.addEventListener(air.HTTPStatusEvent.HTTP_STATUS, self.onStatusEvent);
        self.urlLoader.addEventListener(air.HTTPStatusEvent.HTTP_RESPONSE_STATUS, self.onStatusEvent);
        self.urlLoader.addEventListener(air.Event.COMPLETE, self.onComplete);
        self.urlLoader.addEventListener(air.SecurityErrorEvent.SECURITY_ERROR, self.onError);
        self.urlLoader.addEventListener(air.IOErrorEvent.IO_ERROR, self.onError);
    };

    this.cleanUp = function() {
        self.urlLoader.removeEventListener(air.HTTPStatusEvent.HTTP_STATUS, self.onStatusEvent);
        self.urlLoader.removeEventListener(air.HTTPStatusEvent.HTTP_RESPONSE_STATUS, self.onStatusEvent);
        self.urlLoader.removeEventListener(air.Event.COMPLETE, self.onComplete);
        self.urlLoader.removeEventListener(air.SecurityErrorEvent.SECURITY_ERROR, self.onError);
        self.urlLoader.removeEventListener(air.IOErrorEvent.IO_ERROR, self.onError);
        self.urlLoader = null;
        self.callbackSuccess = null;
        self.callbackError = null;
        self.account = null;
    };

    this.onError = function(evt) {
        air.trace(evt);
        if (self.callbackError) {
            self.callbackError(evt, self.account);
        }
        self.cleanUp();
    };

    this.onStatusEvent = function(evt) {
        air.trace(evt);
        if (evt.status != '200') {
            self.onError(evt);
        }
    };

    this.onComplete = function(evt) {
        air.trace('Complete');
        self.callbackSuccess(evt.target.data, self.account);
        self.cleanUp();
    };

};

Morse.Account = function(username, password, name, id) {
    var self = this;
    this.username = username;
    this.password = password;
    this.name = name;
    this.id = id;
    this.nrItems = -1;
    this.entries = new Array();
    this.ignoreEntriesOlderThan = null;
    this.ignoreNewMessages = false;
}

    Morse.Account.prototype.toString = function() {
        return '{id: ' + this.id + ', name: ' + this.name + ', username: ' + this.username + ', nrItems: ' + this.nrItems + '}';
    };

    Morse.Account.prototype.store = function() {
        Morse.Storage.storeAccount(this);
    };

    Morse.Account.prototype.remove = function() {
        Morse.Storage.removeAccount(this);
    };

    Morse.Account.prototype.getDomain = function() {
        if (!this.username) {
            return null;
        }
        var email = $.trim(this.username);
        if (email == '') {
            return null;
        }
        var atIndex = email.lastIndexOf('@');
        if (atIndex < email.length - 1) {
            return email.substring(atIndex + 1);
        }
        return null;
    };

    Morse.Account.prototype.getUrl = function() {
        var domain = this.getDomain();
        if (domain) {
            domain = domain.toLowerCase();
            if (domain == 'gmail.com' || domain == 'googlemail.com' || domain.indexOf('.') < 0) {
                return 'https://mail.google.com/mail/';
            }
            return 'https://mail.google.com/a/' + domain + '/';
        }
        return null;
    };

    Morse.Account.prototype.getAtomFeedUrl = function() {
        var baseUrl = this.getUrl();
        if (!baseUrl) {
            return null;
        }
        return baseUrl + 'feed/atom';
    };

    Morse.Account.prototype.goToInbox = function() {
        var url = this.getUrl();
        if (url) {
            air.navigateToURL(new air.URLRequest(url));
        }
    };

    Morse.Account.prototype.getOldestEntry = function() {
        if (!this.entries || this.entries.length == 0) {
            return null;
        }
        return this.entries[this.entries.length];
    };

    Morse.Account.loadAll = function() {
        return Morse.Storage.loadAllAccounts();
    };