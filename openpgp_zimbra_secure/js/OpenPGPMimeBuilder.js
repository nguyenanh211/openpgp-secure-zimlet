/**
 * ***** BEGIN LICENSE BLOCK *****
 * OpenPGP Zimbra Secure is the open source digital signature and encrypt for Zimbra Collaboration Open Source Edition software
 * Copyright (C) 2016-present Nguyen Van Nguyen <nguyennv1981@gmail.com>

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
 * Written by Nguyen Van Nguyen <nguyennv1981@gmail.com>
 */

/**
 * Mime builder  constructor.
 */
OpenPGPMimeBuilder = function() {};

OpenPGPMimeBuilder.SIGNED_PREAMBLE = 'This is an OpenPGP/MIME signed message (RFC 4880 and 3156)';
OpenPGPMimeBuilder.ENCRYPTED_PREAMBLE = 'This is an OpenPGP/MIME encrypted message (RFC 4880 and 3156)';
OpenPGPMimeBuilder.VERSION_CONTENT = 'Version: 1';

OpenPGPMimeBuilder.SIGNED_DESC = 'OpenPGP digital signature';
OpenPGPMimeBuilder.ENCRYPTED_DESC = 'OpenPGP encrypted message';
OpenPGPMimeBuilder.VERSION_DESC = 'PGP/MIME Versions Identification';

OpenPGPMimeBuilder.prototype = new Object();
OpenPGPMimeBuilder.prototype.constructor = OpenPGPMimeBuilder;

/**
 * Build plain text mime node.
 *
 * @param {Array} contents The content parts of message for encrypting
 * @param {Array} attachments The attachment parts message for encrypting
 * @return {MimeNode} The plain text mime node
 */
OpenPGPMimeBuilder.prototype.buildPlainText = function(contents, attachments) {
    var MimeNode = window['emailjs-mime-builder'];
    var rootNode, contentNode;
    var mimeNode = new MimeNode();

    if (contents && contents.length > 0) {
        if (contents.length > 1) {
            contentNode = mimeNode.createChild(ZmMimeTable.MULTI_ALT);
            contents.forEach(function(mp){
                contentNode.createChild(mp.ct)
                    .setContent(mp.content._content)
                    .setHeader('content-transfer-encoding', 'quoted-printable');
            });
        }
        else {
            var mp = contents[0];
            contentNode = mimeNode.createChild(mp.ct)
                .setContent(mp.content._content)
                .setHeader('content-transfer-encoding', 'quoted-printable');
        }
    }
    else {
        contentNode = new MimeNode(ZmMimeTable.TEXT_PLAIN);
    }

    if (attachments && attachments.length > 0) {
        rootNode = mimeNode.createChild(ZmMimeTable.MULTI_MIXED);
        rootNode.appendChild(contentNode);
        attachments.forEach(function(mp){
            var attachNode = rootNode.createChild(mp.ct)
                .setHeader('content-transfer-encoding', mp.cte)
                .setHeader('content-disposition', mp.cd)
                .setContent(mp.data);
            if (mp.ci) {
                attachNode.setHeader('content-id', mp.ci);
            }
        });
    }
    else {
        rootNode = contentNode;
    }

    return rootNode;
};

/**
 * Build signed mime node.
 *
 * @param {MimeNode} mimeNode The plain text mime node
 * @param {String} signature The signature of plain text mime node
 * @param {String} hashAlg The hash algorithm of signature
 * @return {MimeNode} The signed mime node
 */
OpenPGPMimeBuilder.prototype.buildSigned = function(mimeNode, signature, hashAlg) {
    var MimeNode = window['emailjs-mime-builder'];
    var ctParts = [
        OpenPGPUtils.SIGNED_MESSAGE_CONTENT_TYPE,
        'protocol="' + OpenPGPUtils.OPENPGP_SIGNATURE_CONTENT_TYPE + '"',
        'micalg="' + hashAlg + '"'
    ];
    var signedNode = new MimeNode(ctParts.join('; '))
        .setContent(OpenPGPMimeBuilder.SIGNED_PREAMBLE);
    signedNode.appendChild(mimeNode);
    signedNode.createChild(OpenPGPUtils.OPENPGP_SIGNATURE_CONTENT_TYPE)
        .setHeader('content-transfer-encoding', '7bit')
        .setHeader('content-description', OpenPGPMimeBuilder.SIGNED_DESC)
        .setContent(signature);
    return signedNode;
};

/**
 * Build encrypted mime node.
 *
 * @param {String} cipherText The cipher text
 * @return {MimeNode} The signed mime node
 */
OpenPGPMimeBuilder.prototype.buildEncrypted = function(cipherText) {
    var MimeNode = window['emailjs-mime-builder'];
    var ctParts = [
        OpenPGPUtils.ENCRYPTED_MESSAGE_CONTENT_TYPE,
        'protocol="' + OpenPGPUtils.OPENPGP_ENCRYPTED_CONTENT_TYPE + '"'
    ];
    var encryptedNode = new MimeNode(ctParts.join('; '))
        .setContent(OpenPGPMimeBuilder.ENCRYPTED_PREAMBLE);
    encryptedNode.createChild(OpenPGPUtils.OPENPGP_ENCRYPTED_CONTENT_TYPE)
        .setHeader('content-transfer-encoding', '7bit')
        .setHeader('content-description', OpenPGPMimeBuilder.VERSION_DESC)
        .setContent(OpenPGPMimeBuilder.VERSION_CONTENT);
    encryptedNode.createChild(ZmMimeTable.APP_OCTET_STREAM, {filename: 'encrypted.asc'})
        .setHeader('content-transfer-encoding', '7bit')
        .setHeader('content-disposition', 'inline')
        .setHeader('content-description', OpenPGPMimeBuilder.ENCRYPTED_DESC)
        .setContent(cipherText);
    return encryptedNode;
};
