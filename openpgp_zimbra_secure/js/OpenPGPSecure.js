/*
 * ***** BEGIN LICENSE BLOCK *****
 * OpenPGP Zimbra Secure is the open source digital signature and encrypt for Zimbra Collaboration Open Source Edition software
 * Copyright (C) 2016-present OpenPGP Zimbra Secure

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>
 * ***** END LICENSE BLOCK *****
 *
 * OpenPGP MIME Secure Email Zimlet
 *
 * Written by nguyennv1981@gmail.com
 */

var OPENPGP_SECURITY_TYPES = [
    {label: openpgp_zimbra_secure.dontSignMessage, className: 'DontSign'},
    {label: openpgp_zimbra_secure.signMessage, className: 'Sign'},
    {label: openpgp_zimbra_secure.signAndEncryptMessage, className:"SignEncrypt"}
];

function openpgp_zimbra_secure_HandlerObject() {
    this._msgDivCache = {};
    this._smimeCache = appCtxt.isChildWindow ? window.opener.openpgp_zimbra_secure_HandlerObject.getInstance()._smimeCache : {};
    this._patchedFuncs = {};
    this._pendingAttachments = [];
};

openpgp_zimbra_secure_HandlerObject.prototype = new ZmZimletBase();
openpgp_zimbra_secure_HandlerObject.prototype.constructor = openpgp_zimbra_secure_HandlerObject;

openpgp_zimbra_secure_HandlerObject.prototype.toString = function() {
    return 'openpgp_zimbra_secure_HandlerObject';
};

var OpenPGPZimbraSecure = openpgp_zimbra_secure_HandlerObject;

OpenPGPZimbraSecure.BUTTON_CLASS = 'openpgp_zimbra_secure_button';
OpenPGPZimbraSecure.PREF_SECURITY = 'OPENPGP_SECURITY';
OpenPGPZimbraSecure.USER_SECURITY = 'OPENPGP_USER_SECURITY';

OpenPGPZimbraSecure.OPENPGP_DONTSIGN = 0;
OpenPGPZimbraSecure.OPENPGP_SIGN = 1;
OpenPGPZimbraSecure.OPENPGP_SIGNENCRYPT = 2;

OpenPGPZimbraSecure.prototype.init = function() {
    var self = this;

    AjxDispatcher.addPackageLoadFunction('MailCore', new AjxCallback(this, function(){
    }));

    OpenPGPSecurePrefs.init(this);
}

OpenPGPZimbraSecure.getInstance = function() {
    return appCtxt.getZimletMgr().getZimletByName('openpgp_zimbra_secure').handlerObject;
};

/**
 * This method gets called by the Zimlet framework when a toolbar is created.
 *
 * @param {ZmApp} app
 * @param {ZmButtonToolBar} toolbar
 * @param {ZmController} controller
 * @param {String} viewId
 */
OpenPGPZimbraSecure.prototype.initializeToolbar = function(app, toolbar, controller, viewId) {
    if (viewId.indexOf('COMPOSE') >= 0) {
        var button;
        var children = toolbar.getChildren();
        for (var i = 0; i < children.length && !button; i++) {
            if (Dwt.hasClass(children[i].getHtmlElement(), OpenPGPZimbraSecure.BUTTON_CLASS)) {
                button = children[i];
                break;
            }
        }
        var selectedValue;
        var enableSecurityButton = true;
        var msg = controller.getMsg();
        if (msg && msg.isInvite()) {
            selectedValue = OpenPGPZimbraSecure.OPENPGP_DONTSIGN;
            enableSecurityButton = false;
        } else if (msg && msg.isDraft) {
            selectedValue = OpenPGPZimbraSecure.OPENPGP_DONTSIGN;
        } else {
            selectedValue = this._getSecuritySetting();
        }
        if (!button) {
            var index = AjxUtil.indexOf(toolbar.opList, ZmOperation.COMPOSE_OPTIONS) + 1;
            var id = Dwt.getNextId() + '_' + OpenPGPZimbraSecure.BUTTON_CLASS;
            
            var securityButton = new DwtToolBarButton({
                parent:toolbar,
                id:id + '_checkbox',
                index:index,
                className: OpenPGPZimbraSecure.BUTTON_CLASS + ' ZToolbarButton'
            });

            var securityMenu = new DwtMenu({
                parent: securityButton,
                id: id + '_menu'
            });
            var signingRadioId = id + '_menu_sign';

            securityButton.setMenu(securityMenu);

            var listener = new AjxListener(this, this._handleSelectSigning, [securityButton]);

            var nosignButton = new DwtMenuItem({parent:securityMenu, style:DwtMenuItem.RADIO_STYLE, radioGroupId: signingRadioId});
            nosignButton.setText(openpgp_zimbra_secure.dontSignMessage);
            nosignButton.addSelectionListener(listener);
            nosignButton.setData('sign', OpenPGPZimbraSecure.OPENPGP_DONTSIGN);

            var signButton = new DwtMenuItem({parent:securityMenu, style:DwtMenuItem.RADIO_STYLE, radioGroupId: signingRadioId});
            signButton.setText(openpgp_zimbra_secure.signMessage);
            signButton.addSelectionListener(listener);
            signButton.setData('sign', OpenPGPZimbraSecure.OPENPGP_SIGN);

            var signAndEncryptButton = new DwtMenuItem({parent:securityMenu, style:DwtMenuItem.RADIO_STYLE, radioGroupId: signingRadioId});
            signAndEncryptButton.setText(openpgp_zimbra_secure.signAndEncryptMessage);
            signAndEncryptButton.addSelectionListener(listener);
            signAndEncryptButton.setData("sign", OpenPGPZimbraSecure.OPENPGP_SIGNENCRYPT);

            securityMenu.checkItem('sign', selectedValue, true);
            this._setSecurityImage(securityButton, selectedValue);
            securityButton.setEnabled(enableSecurityButton);
        } else {
            var menu = button.getMenu();
            if (menu) {
                menu.checkItem('sign', selectedValue, true);
                this._setSecurityImage(button, selectedValue);
            }
            button.setEnabled(enableSecurityButton);
        }
    }
};

OpenPGPZimbraSecure.prototype._setSecurityImage = function(button, value) {
    button.setImage(OPENPGP_SECURITY_TYPES[value].className);
    button.setText(OPENPGP_SECURITY_TYPES[value].label);
};

/*
 * Event handler for select signing button on toolbar
 */
OpenPGPZimbraSecure.prototype._handleSelectSigning = function(button, ev) {
    var value = ev.dwtObj.getData('sign');

    this._setSecurityImage(button, value);

    var view = appCtxt.getCurrentView();
    var composeCtrl = view && view.getController && view.getController();

    // hide upload button form to suppress HTML5 file upload dialogs
    OpenPGPZimbraSecure._fixFormVisibility(view._attButton.getHtmlElement(), value == OpenPGPZimbraSecure.OPENPGP_DONTSIGN);

    this.setUserProperty(OpenPGPZimbraSecure.USER_SECURITY, value);
    this.saveUserProperties();
    composeCtrl.saveDraft(ZmComposeController.DRAFT_TYPE_AUTO);
};

OpenPGPZimbraSecure._fixFormVisibility = function(element, visible) {
    if (AjxEnv.supportsHTML5File) {
        var forms = element.getElementsByTagName('form');

        for (var i = 0; i < forms.length; i++)
            Dwt.setVisible(forms.item(i), visible);
    }
};

OpenPGPZimbraSecure.prototype._getSecurityButtonFromToolbar = function(toolbar) {
    var children = toolbar.getChildren();
    for (var i = 0; i < children.length; i++) {
        if (Dwt.hasClass(children[i].getHtmlElement(), OpenPGPZimbraSecure.BUTTON_CLASS)) {
            return children[i];
        }
    }
};

OpenPGPZimbraSecure.prototype._getUserSecuritySetting = function(ctlr, useToolbarOnly) {
    var app = appCtxt.getApp('Mail');
    AjxDispatcher.require(['MailCore','Mail']);
    var view = appCtxt.getAppViewMgr().getCurrentView();
    ctlr = ctlr || (view && view.isZmComposeView && view.getController());
    if (!useToolbarOnly) {
        ctlr = ctlr || app.getComposeController(app.getCurrentSessionId('COMPOSE'));
    }
    var toolbar = ctlr && ctlr._toolbar;
    var button = toolbar && this._getSecurityButtonFromToolbar(toolbar);
    var menu = button && button.getMenu();

    if (menu) {
        return menu.getSelectedItem().getData('sign');
    } else if (useToolbarOnly) {
        //only local setting is requested.
        return false;
    } else {
        return this._getSecuritySetting();
    }
};

OpenPGPZimbraSecure.prototype._getSecuritySetting = function() {
    if (appCtxt.isChildWindow) {
        return window.opener.appCtxt.getZimletMgr().getZimletByName('openpgp_zimbra_secure').handlerObject._getUserSecuritySetting();
    } else {
        var setting = appCtxt.get(OpenPGPZimbraSecure.PREF_SECURITY);
        if (setting == 'auto') {
            return Number(this.getUserProperty(OpenPGPZimbraSecure.USER_SECURITY) || 0);
        } else {
            return Number(setting);
        }
    }
};

OpenPGPZimbraSecure.prototype._addJsScript = function(path) {
    var head = document.getElementsByTagName('HEAD').item(0);
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = this.getResource(path);
    head.appendChild(script);
};