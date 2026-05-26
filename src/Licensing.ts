function timeTrialExpired(): void {
    g_Trial_Time_In_Minutes--;
    if (g_Trial_Time_In_Minutes > 0) {
        let s = "";
        if (g_Trial_Time_In_Minutes > 1) {
            s = "s";
        }
        SystemVars.Write("TrialExpireMinutes", "Trial Expires in " + g_Trial_Time_In_Minutes + " Minute" + s);
    }
    else {
        g_Trial_Expired = true;
        SystemVars.Write("TrialTimeExpired", true);
        SystemVars.Write("TrialExpiresOn", g_DriverName + " is Expired");
        SystemVars.Write("TrialExpireMinutes", g_DriverName + " is Expired");
        SystemVars.Write("SerialNumber", "Serial number listed in driver(" + Config.Get("SerialNumber") + ") isn't valid for this processor");
        System.Print(g_DriverName + " is Expired \r\n");
        try {
            if (g_Check_Trial_Expired != undefined) {
                g_Check_Trial_Expired.Disable();
            }
        }
        catch (e) { }
    }
}

function checkSerial(): void {
    let serialNumber = Config.Get("SerialNumber").replace(/^\s+|\s+$/g, '');
    if (serialNumber.length == 0) { serialNumber = " N/A "; }
    if (checkLicense(serialNumber) == false) {
        //The serial number isn't valid so the driver will only work for a set amount of time and then be disabled.
        if (g_Check_Trial_Expired.Enabled != true) {
            System.Print("Error creating trial expire schedule " + g_Check_Trial_Expired + " \r\n");
        }
        System.Print(g_DriverName + " Serial Number: " + serialNumber + "   is not valid for this processor \r\n Trial will expire in " + g_Trial_Time_In_Minutes + " minutes \r\n");
        SystemVars.Write("SerialNumber", g_DriverName + " Serial Number: " + serialNumber + "  is NOT valid for this processor");

        let v = new Date();
        v.setMinutes(v.getMinutes() + g_Trial_Time_In_Minutes);
        System.Print(g_DriverName + " will expire on: " + v.toString());
        SystemVars.Write("TrialExpiresOn", g_DriverName + " expires on " + formatDate(v.toLocaleTimeString()));
        SystemVars.Write("TrialExpireMinutes", g_DriverName + " Trial Expires in " + g_Trial_Time_In_Minutes + " Minutes");
    }
    else {
        g_Check_Trial_Expired.Disable();
        System.Print(g_DriverName + " Serial Number: " + serialNumber + "  is valid for this processor \r\n");
        SystemVars.Write("SerialNumber", g_DriverName + " Serial Number: " + serialNumber + "  is valid for this processor");
        SystemVars.Write("TrialExpiresOn", g_DriverName + " will never expire");
        SystemVars.Write("ValidSerial", true);
        g_Valid_Serial_Number = true;
    }
}

const encoder: any = {};
// @ts-ignore
encoder.cipher = function (input, w) { var Nb = 4, Nr = w.length / Nb - 1, state = [[], [], [], []]; for (var i = 0; i < 4 * Nb; i++) state[i % 4][Math.floor(i / 4)] = input[i]; state = encoder.addRoundKey(state, w, 0, Nb); for (var round = 1; round < Nr; round++) state = encoder.subBytes(state, Nb), state = encoder.shiftRows(state, Nb), state = encoder.mixColumns(state, Nb), state = encoder.addRoundKey(state, w, round, Nb); state = encoder.subBytes(state, Nb), state = encoder.shiftRows(state, Nb), state = encoder.addRoundKey(state, w, Nr, Nb); var output = new Array(4 * Nb); for (var i = 0; i < 4 * Nb; i++) output[i] = state[i % 4][Math.floor(i / 4)]; return output }, encoder.keyExpansion = function (key) { var Nb = 4, Nk = key.length / 4, Nr = Nk + 6, w = new Array(Nb * (Nr + 1)), temp = new Array(4); for (var i = 0; i < Nk; i++) { var r = [key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]]; w[i] = r } for (var i = Nk; i < Nb * (Nr + 1) ; i++) { w[i] = new Array(4); for (var t = 0; t < 4; t++) temp[t] = w[i - 1][t]; if (i % Nk == 0) { temp = encoder.subWord(encoder.rotWord(temp)); for (var t = 0; t < 4; t++) temp[t] ^= encoder.rCon[i / Nk][t] } else Nk > 6 && i % Nk == 4 && (temp = encoder.subWord(temp)); for (var t = 0; t < 4; t++) w[i][t] = w[i - Nk][t] ^ temp[t] } return w }, encoder.subBytes = function (s, Nb) { for (var r = 0; r < 4; r++) for (var c = 0; c < Nb; c++) s[r][c] = encoder.sBox[s[r][c]]; return s }, encoder.shiftRows = function (s, Nb) { var t = new Array(4); for (var r = 1; r < 4; r++) { for (var c = 0; c < 4; c++) t[c] = s[r][(c + r) % Nb]; for (var c = 0; c < 4; c++) s[r][c] = t[c] } return s }, encoder.mixColumns = function (s, Nb) { for (var c = 0; c < 4; c++) { var a = new Array(4), b = new Array(4); for (var i = 0; i < 4; i++) a[i] = s[i][c], b[i] = s[i][c] & 128 ? s[i][c] << 1 ^ 283 : s[i][c] << 1; s[0][c] = b[0] ^ a[1] ^ b[1] ^ a[2] ^ a[3], s[1][c] = a[0] ^ b[1] ^ a[2] ^ b[2] ^ a[3], s[2][c] = a[0] ^ a[1] ^ b[2] ^ a[3] ^ b[3], s[3][c] = a[0] ^ b[0] ^ a[1] ^ a[2] ^ b[3] } return s }, encoder.addRoundKey = function (state, w, rnd, Nb) { for (var r = 0; r < 4; r++) for (var c = 0; c < Nb; c++) state[r][c] ^= w[rnd * 4 + c][r]; return state }, encoder.subWord = function (w) { for (var i = 0; i < 4; i++) w[i] = encoder.sBox[w[i]]; return w }, encoder.rotWord = function (w) { var tmp = w[0]; for (var i = 0; i < 3; i++) w[i] = w[i + 1]; return w[3] = tmp, w }, encoder.sBox = [99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171, 118, 202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164, 114, 192, 183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113, 216, 49, 21, 4, 199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226, 235, 39, 178, 117, 9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214, 179, 41, 227, 47, 132, 83, 209, 0, 237, 32, 252, 177, 91, 106, 203, 190, 57, 74, 76, 88, 207, 208, 239, 170, 251, 67, 77, 51, 133, 69, 249, 2, 127, 80, 60, 159, 168, 81, 163, 64, 143, 146, 157, 56, 245, 188, 182, 218, 33, 16, 255, 243, 210, 205, 12, 19, 236, 95, 151, 68, 23, 196, 167, 126, 61, 100, 93, 25, 115, 96, 129, 79, 220, 34, 42, 144, 136, 70, 238, 184, 20, 222, 94, 11, 219, 224, 50, 58, 10, 73, 6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121, 231, 200, 55, 109, 141, 213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8, 186, 120, 37, 46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189, 139, 138, 112, 62, 181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134, 193, 29, 158, 225, 248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206, 85, 40, 223, 140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187, 22], encoder.rCon = [[0, 0, 0, 0], [1, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [8, 0, 0, 0], [16, 0, 0, 0], [32, 0, 0, 0], [64, 0, 0, 0], [128, 0, 0, 0], [27, 0, 0, 0], [54, 0, 0, 0]], encoder.Ctr = {}, encoder.Ctr.decrypt = function (ciphertext, password) { var blockSize = 16; ciphertext = String(ciphertext).baseDecode(), password = String(password).utf8Encode(); var nBytes = 32, pwBytes = new Array(nBytes); for (var i = 0; i < nBytes; i++) pwBytes[i] = isNaN(password.charCodeAt(i)) ? 0 : password.charCodeAt(i); var key = encoder.cipher(pwBytes, encoder.keyExpansion(pwBytes)); key = key.concat(key.slice(0, nBytes - 16)); var counterBlock = new Array(8), ctrTxt = ciphertext.slice(0, 8); for (var i = 0; i < 8; i++) counterBlock[i] = ctrTxt.charCodeAt(i); var keySchedule = encoder.keyExpansion(key), nBlocks = Math.ceil((ciphertext.length - 8) / blockSize), ct = new Array(nBlocks); for (var b = 0; b < nBlocks; b++) ct[b] = ciphertext.slice(8 + b * blockSize, 8 + b * blockSize + blockSize); ciphertext = ct; var plaintxt = new Array(ciphertext.length); for (var b = 0; b < nBlocks; b++) { for (var c = 0; c < 4; c++) counterBlock[15 - c] = b >>> c * 8 & 255; for (var c = 0; c < 4; c++) counterBlock[15 - c - 4] = (b + 1) / 4294967296 - 1 >>> c * 8 & 255; var cipherCntr = encoder.cipher(counterBlock, keySchedule), plaintxtByte = new Array(ciphertext[b].length); for (var i = 0; i < ciphertext[b].length; i++) plaintxtByte[i] = cipherCntr[i] ^ ciphertext[b].charCodeAt(i), plaintxtByte[i] = String.fromCharCode(plaintxtByte[i]); plaintxt[b] = plaintxtByte.join("") } var plaintext = plaintxt.join(""); return plaintext = plaintext.utf8Decode(), plaintext }, typeof String.prototype.utf8Encode == "undefined" && (String.prototype.utf8Encode = function () { return unescape(encodeURIComponent(this)) }), typeof String.prototype.utf8Decode == "undefined" && (String.prototype.utf8Decode = function () { try { return decodeURIComponent(escape(this)) } catch (e) { return this } }), typeof String.prototype.baseDecode == "undefined" && (String.prototype.baseDecode = function () { if (typeof Dbase != "undefined") return Dbase(this).toString("utf8"); throw new Error("No Base Decode") }); function Dbase(s) { var b = l = 0, r = "", m = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split(""); return [].forEach.call(s, function (v) { b = (b << 6) + m.indexOf(v), l += 6; while (l >= 8) r += String.fromCharCode(b >>> (l -= 8) & 255) }), r }
function checkLicense(strKey: string): boolean {
    const strLicense = strKey || "bAd7SAZpWFxwfblQRbWGSF"; //0260A5  //Integer*2,Mac*2*3
    dbg("License Key(" + strLicense.length + ") = " + strLicense);
    const strRotate = "030b09060804141100150d020113120a100e070c0f05";
    let strOut = "";
    for (var i = 0; i < strRotate.length; i += 2) {
        strOut += strLicense.charAt(parseInt(strRotate.substr(i, 2), 16));
    }
    const strOut2 = encoder.Ctr.decrypt(strOut, g_DriverUniqueName);
    if (strOut2.length != 8) {
        dbg("License Key Error!");
        return false;
    }
    var mac = "001526" + strOut2.substr(2).toUpperCase();
    var driverLevel = strOut2.substr(0, 2);
    var licenseOk = (System.MACAddress.replace(/:/g, "").toUpperCase() == mac);
    dbg("System.MacAddress = " + System.MACAddress);
    dbg("Decrypted: Mac = " + mac + ", Level = " + driverLevel + ", LicenseOK = " + licenseOk);
    dbg("Thanks for everything Nozza87!");
    return licenseOk;
}
