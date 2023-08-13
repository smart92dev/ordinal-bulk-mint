const buf = buffer;
const { Address, Script, Signer, Tap, Tx } = window.tapscript

let db;
let active_plugin = null;
let $ = document.querySelector.bind(document);
let $$ = document.querySelectorAll.bind(document);
let url_params = new URLSearchParams(window.location.search);
let url_keys = url_params.keys();
let $_GET = {}
for (let key of url_keys) $_GET[key] = url_params.get(key);

// no changes from here
let privkey = bytesToHex(cryptoUtils.Noble.utils.randomPrivateKey());
let pushing = false;
let files = [];

sessionStorage.clear();

let slider = document.getElementById("sats_range");
let output = document.getElementById("sats_per_byte");
output.innerHTML = slider.value;
slider.oninput = function () {
    output.innerHTML = this.value;
    sessionStorage["feerate"] = this.value;
    $$('.fee .num').forEach(function (item) {
        item.style.backgroundColor = "grey";
    });
}

window.onload = async function () {

    $('#padding').value = padding;
    $('.text').onclick = showText;
    $('.upload_file').onclick = showUploader;
    $('.registration').onclick = showRegister;
    $('.unisat').onclick = showUnisat;
    $('.brc20_mint').onclick = showBrc20Mint;
    $('.brc20_deploy').onclick = showBrc20Deploy;
    $('.brc20_transfer').onclick = showBrc20Transfer;
    $('#backup-usage').onclick = showBackupUsage;
    $('#tip').onfocus = async function(){

        this.value = '';
    };
    $('#tip').onkeyup = async function(){

        let tip = $('#tip').value.replace(/[^0-9]/g, '');

        if(isNaN(parseInt($('#tip').value)) || parseInt(tip) < 0){

            $('#tip').value = '';
        }

        $('#tip-usd').innerHTML = Number(await satsToDollars(tip)).toFixed(2);
    };

    await initDatabase();

    let quota = await insQuota();
    let usage = Math.round(( (quota.usage/quota.quota) + Number.EPSILON) * 10000) / 10000;
    $('#db-quota').innerHTML = usage + '%';

    setInterval(async function(){

        let quota = await insQuota();
        let usage = Math.round(( (quota.usage/quota.quota) + Number.EPSILON) * 10000) / 10000;
        $('#db-quota').innerHTML = usage + '%';

    }, 5000);

    loadPlugins();

    try
    {
        await fetch('https://www3.doubleclick.net', {
            method: "HEAD",
            mode: "no-cors",
            cache: "no-store",
        });

        let adBoxEl = document.querySelector(".ad-box")
        let hasAdBlock = window.getComputedStyle(adBoxEl)?.display === "none"

        if(hasAdBlock)
        {
            throw new Error('Adblock detected');
        }
    }
    catch (e)
    {
        alert('To make sure inscribing will work properly, disable all adblockers for this app. If you use brave, turn off its shield.' + "\n\n" + 'We do NOT place ads nor will we track you.');
    }
};

async function showBackupUsage()
{
    if($('#backup-list').style.display == 'none')
    {
        $('#backup-list').style.display = 'block';

        let html = '';
        let keys = await insGetAllKeys();

        for(let i = 0; i < keys.length; i++)
        {
            let date = await insDateGet(keys[i]);
            html += '<div style="font-size: 14px;" id="backup-item-'+keys[i]+'">[<a href="javascript:void(0);" onclick="startInscriptionRecovery(\''+keys[i]+'\')" style="font-size: 14px;">recover</a>] [<a href="javascript:void(0);" onclick="deleteInscription(\''+keys[i]+'\')" style="font-size: 14px;">delete</a>] '+date+'<hr/></div>';
        }

        $('#backup-list').innerHTML = html;
    }
    else
    {
        $('#backup-recovery').style.display = 'none';
        $('#backup-list').style.display = 'none';
        $('#backup-list').innerHTML = '';
    }
}

async function deleteInscription(key){

    let result = confirm('Are you sure you want to delete this backup entry? If you are not sure, check if there is anything to recover first.');

    if(result)
    {
        await insDelete(key);
        await insDateDelete(key);
        $('#backup-item-'+key).remove();
    }
}

async function startInscriptionRecovery(key) {

    $('#backup-recovery').innerHTML = '<div id="recovery-info">Please wait, searching for UTXOs<span class="dots">.</span></div>';
    $('#backup-recovery').style.display = 'block';

    let utxos_found = false;
    let processed = [];
    let tx = JSON.parse(await insGet(key));

    for (let i = 0; i < tx.length; i++) {

        if(!Array.isArray(tx[i].output.scriptPubKey))
        {
            if(tx[i].output.scriptPubKey.startsWith('5120'))
            {
                tx[i].output.scriptPubKey = tx[i].output.scriptPubKey.slice(4);
            }

            tx[i].output.scriptPubKey = ['OP_1', tx[i].output.scriptPubKey];
        }

        let plainTapKey = tx[i].output.scriptPubKey[1];

        if (processed.includes(plainTapKey)) {

            continue;
        }

        let response = await getData('https://mempool.space/'+mempoolNetwork+'api/address/' + Address.p2tr.encode(plainTapKey, encodedAddressPrefix) + '/utxo');
        let utxos = JSON.parse(response);
        let utxo = null;

        for (let j = 0; j < utxos.length; j++) {

            utxo = utxos[j];

            if (utxo !== null) {
                utxos_found = true;
                $('#recovery-info').style.display = 'none';
                $('#backup-recovery').innerHTML += '<div id="recovery-item-' + key + '-'+utxo.vout+'" style="font-size: 14px;">Found UTXO with ' + utxo.value + ' sats [<a style="font-size: 14px;" href="javascript:void(0);" onclick="recover(' + i + ', ' + utxo.vout + ', $(\'#taproot_address\').value, \'' + key + '\')">recover</a>]</div>';
                $('#backup-recovery').innerHTML += '<hr/>';

                console.log(utxo);
            }
        }

        processed.push(plainTapKey);

        await sleep(1000);
    }

    if(!utxos_found)
    {
        $('#backup-recovery').innerHTML = '<div id="recovery-info">No UTXOs found</div>';
    }
}

function showUnisat() {
    $('#padding').value = '546';
    padding = '546';
    files = [];
    $('#app-form').reset();
    $('.text_form').style.display = "none";
    $('.brc20_deploy_form').style.display = "none";
    $('.brc20_mint_form').style.display = "none";
    $('.brc20_transfer_form').style.display = "none";
    $('.file_form').style.display = "none";
    $('.dns_form').style.display = "none";
    $('.dns_checker').style.display = "none";
    $('.dns').value = "";
    $('.unisat_form').style.display = "block";
    $('.unisat_checker').style.display = "block";
    $('.unisat').value = "";
    $('#plugin_form').style.display = 'none';
    $$('.options a').forEach(function(item){
        item.classList.remove('active');
    });
    active_plugin = null;
    document.getElementById('brc20_mint_nav').classList.remove('active');
    document.getElementById('brc20_deploy_nav').classList.remove('active');
    document.getElementById('brc20_transfer_nav').classList.remove('active');
    document.getElementById('upload_file_nav').classList.remove('active');
    document.getElementById('registration_nav').classList.remove('active');
    document.getElementById('unisat_nav').classList.add('active');
    document.getElementById('text_nav').classList.remove('active');
}

function showText() {
    $('#padding').value = '546';
    padding = '546';
    files = [];

    let cloned = $$('.text_area')[0].cloneNode(true);
    cloned.value = '';
    $('#form_container').innerHTML = '';
    document.getElementById("form_container").appendChild(cloned);

    $('#text-addrow').style.display = 'none';

    $('#app-form').reset();
    $('.text_form').style.display = "inline";
    $('.brc20_deploy_form').style.display = "none";
    $('.brc20_mint_form').style.display = "none";
    $('.brc20_transfer_form').style.display = "none";
    $('.file_form').style.display = "none";
    $('.dns_form').style.display = "none";
    $('.dns_checker').style.display = "none";
    $('.dns').value = "";
    $('.unisat_form').style.display = "none";
    $('.unisat_checker').style.display = "none";
    $('.unisat').value = "";
    $('#plugin_form').style.display = 'none';
    $$('.options a').forEach(function(item){
        item.classList.remove('active');
    });
    active_plugin = null;
    document.getElementById('brc20_mint_nav').classList.remove('active');
    document.getElementById('brc20_deploy_nav').classList.remove('active');
    document.getElementById('brc20_transfer_nav').classList.remove('active');
    document.getElementById('upload_file_nav').classList.remove('active');
    document.getElementById('registration_nav').classList.remove('active');
    document.getElementById('unisat_nav').classList.remove('active');
    document.getElementById('text_nav').classList.add('active');
}

function showRegister() {
    $('#padding').value = '546';
    padding = '546';
    files = [];
    $('#app-form').reset();
    $('.text_form').style.display = "none";
    $('.brc20_deploy_form').style.display = "none";
    $('.brc20_mint_form').style.display = "none";
    $('.brc20_transfer_form').style.display = "none";
    $('.file_form').style.display = "none";
    $('.dns_form').style.display = "block";
    $('.dns_checker').style.display = "inline";
    $('.dns').value = "";
    $('.unisat_form').style.display = "none";
    $('.unisat_checker').style.display = "none";
    $('.unisat').value = "";
    $('#plugin_form').style.display = 'none';
    $$('.options a').forEach(function(item){
        item.classList.remove('active');
    });
    active_plugin = null;
    document.getElementById('brc20_mint_nav').classList.remove('active');
    document.getElementById('brc20_deploy_nav').classList.remove('active');
    document.getElementById('brc20_transfer_nav').classList.remove('active');
    document.getElementById('upload_file_nav').classList.remove('active');
    document.getElementById('registration_nav').classList.add('active');
    document.getElementById('unisat_nav').classList.remove('active');
    document.getElementById('text_nav').classList.remove('active');
}

function showUploader() {
    $('#padding').value = '10000';
    padding = '10000';
    files = [];
    $('#app-form').reset();
    $('.text_form').style.display = "none";
    $('.brc20_deploy_form').style.display = "none";
    $('.brc20_mint_form').style.display = "none";
    $('.brc20_transfer_form').style.display = "none";
    $('.file_form').style.display = "block";
    $('.dns_form').style.display = "none";
    $('.dns_checker').style.display = "none";
    $('.unisat_form').style.display = "none";
    $('.unisat_checker').style.display = "none";
    $('.unisat').value = "";
    $('#plugin_form').style.display = 'none';
    $$('.options a').forEach(function(item){
        item.classList.remove('active');
    });
    active_plugin = null;
    document.getElementById('brc20_mint_nav').classList.remove('active');
    document.getElementById('brc20_deploy_nav').classList.remove('active');
    document.getElementById('brc20_transfer_nav').classList.remove('active');
    document.getElementById('upload_file_nav').classList.add('active');
    document.getElementById('registration_nav').classList.remove('active');
    document.getElementById('unisat_nav').classList.remove('active');
    document.getElementById('text_nav').classList.remove('active');
}

function showBrc20Deploy() {
    $('#padding').value = '546';
    padding = '546';
    files = [];
    $('#app-form').reset();
    $('.text_form').style.display = "none";
    $('.brc20_deploy_form').style.display = "block";
    $('.brc20_mint_form').style.display = "none";
    $('.brc20_transfer_form').style.display = "none";
    $('.file_form').style.display = "none";
    $('.dns_form').style.display = "none";
    $('.dns_checker').style.display = "none";
    $('.registration').onclick = showRegister;
    $('.unisat_form').style.display = "none";
    $('.unisat_checker').style.display = "none";
    $('.unisat').value = "";
    $('#plugin_form').style.display = 'none';
    $$('.options a').forEach(function(item){
        item.classList.remove('active');
    });
    active_plugin = null;
    document.getElementById('brc20_mint_nav').classList.remove('active');
    document.getElementById('brc20_deploy_nav').classList.add('active');
    document.getElementById('brc20_transfer_nav').classList.remove('active');
    document.getElementById('upload_file_nav').classList.remove('active');
    document.getElementById('registration_nav').classList.remove('active');
    document.getElementById('unisat_nav').classList.remove('active');
    document.getElementById('text_nav').classList.remove('active');
}

function showBrc20Mint() {
    $('#padding').value = '546';
    padding = '546';
    files = [];
    $('#app-form').reset();
    $('.text_form').style.display = "none";
    $('.brc20_deploy_form').style.display = "none";
    $('.brc20_mint_form').style.display = "block";
    $('.brc20_transfer_form').style.display = "none";
    $('.file_form').style.display = "none";
    $('.dns_form').style.display = "none";
    $('.dns_checker').style.display = "none";
    $('.registration').onclick = showRegister;
    $('.unisat_form').style.display = "none";
    $('.unisat_checker').style.display = "none";
    $('.unisat').value = "";
    $('#plugin_form').style.display = 'none';
    $$('.options a').forEach(function(item){
        item.classList.remove('active');
    });
    active_plugin = null;
    document.getElementById('brc20_mint_nav').classList.add('active');
    document.getElementById('brc20_deploy_nav').classList.remove('active');
    document.getElementById('brc20_transfer_nav').classList.remove('active');
    document.getElementById('upload_file_nav').classList.remove('active');
    document.getElementById('registration_nav').classList.remove('active');
    document.getElementById('unisat_nav').classList.remove('active');
    document.getElementById('text_nav').classList.remove('active');
}

function showBrc20Transfer() {
    $('#padding').value = '546';
    padding = '546';
    files = [];
    $('#app-form').reset();
    $('.text_form').style.display = "none";
    $('.brc20_deploy_form').style.display = "none";
    $('.brc20_mint_form').style.display = "none";
    $('.brc20_transfer_form').style.display = "block";
    $('.file_form').style.display = "none";
    $('.dns_form').style.display = "none";
    $('.dns_checker').style.display = "none";
    $('.registration').onclick = showRegister;
    $('.unisat_form').style.display = "none";
    $('.unisat_checker').style.display = "none";
    $('.unisat').value = "";
    $('#plugin_form').style.display = 'none';
    $$('.options a').forEach(function(item){
        item.classList.remove('active');
    });
    active_plugin = null;
    document.getElementById('brc20_mint_nav').classList.remove('active');
    document.getElementById('brc20_deploy_nav').classList.remove('active');
    document.getElementById('brc20_transfer_nav').classList.add('active');
    document.getElementById('upload_file_nav').classList.remove('active');
    document.getElementById('registration_nav').classList.remove('active');
    document.getElementById('unisat_nav').classList.remove('active');
    document.getElementById('text_nav').classList.remove('active');

    $('#brc-transfer-container').innerHTML = '<div class="brc-transfer-block">' + $$('.brc-transfer-block')[0].innerHTML + '</div>';

    async function addTransferBlock(e)
    {
        e.preventDefault();
        let div = document.createElement('div');
        div.classList.add('brc-transfer-block');
        div.innerHTML = '<hr/>' + '<div class="brc-transfer-block">' + $$('.brc-transfer-block')[0].innerHTML + '</div>';
        $('#brc-transfer-container').appendChild(div);
        return false;
    }

    $('#add_transfer_button').onclick = addTransferBlock;
}

showUploader();

$('.form').addEventListener("change", async function () {

    files = [];

    let limit_reached = 0;

    for (let i = 0; i < this.files.length; i++) {

        let b64;
        let mimetype = this.files[i].type;

        if (mimetype.includes("text/plain")) {

            mimetype += ";charset=utf-8";
        }

        if (this.files[i].size >= 350000) {

            limit_reached += 1;

        } else {

            b64 = await encodeBase64(this.files[i]);
            let base64 = b64.substring(b64.indexOf("base64,") + 7);
            let hex = base64ToHex(base64);

            //console.log( "hex:", hex );
            //console.log( "bytes:", hexToBytes( hex ) );

            console.log(this.files[i]);

            let sha256 = await fileToSha256Hex(this.files[i]);
            files.push({
                name: this.files[i].name,
                hex: hex,
                mimetype: mimetype,
                sha256: sha256.replace('0x', '')
            });
        }
    }

    if (limit_reached != 0) {
        alert(limit_reached + " of your desired inscriptions exceed(s) the maximum of 350kb.")
    }

    console.log(files);
});

$('.startover').addEventListener("click", async function () {

    location.reload();
});

$('.estimate').addEventListener("click", async function () {

    run(true);
});

$('.submit').addEventListener("click", async function () {

    run(false);
});

async function run(estimate) {

    if (!estimate && !isValidAddress()) {
        alert('Invalid taproot address.');
        return;
    }

    let mempool_success = await probeAddress($('.address').value, true);

    if (!estimate && !mempool_success) {
        alert('Could not establish a connection to Mempool.space. Most likely you got rate limited. Please wait a few minutes before you try inscribing.');
        return;
    }

    if ($('.brc20_deploy_form').style.display != "none") {

        files = [];

        let deploy = '{ \n' +
            '  "p": "brc-20",\n' +
            '  "op": "deploy",\n' +
            '  "tick": "",\n' +
            '  "max": "",\n' +
            '  "lim": ""\n' +
            '}';

        if (isNaN(parseInt($('#brc20-deploy-max').value))) {
            alert('Invalid supply.');
            return;
        }

        if (isNaN(parseInt($('#brc20-deploy-lim').value))) {
            alert('Invalid limit.');
            return;
        }

        if ($('#brc20-deploy-ticker').value == '' || $('#brc20-deploy-ticker').value.length < 2) {
            alert('Invalid ticker length. Must be at least 2 characters.');
            return;
        }

        deploy = JSON.parse(deploy);
        deploy.tick = $('#brc20-deploy-ticker').value;
        deploy.max = $('#brc20-deploy-max').value;
        deploy.lim = $('#brc20-deploy-lim').value;

        let mimetype = "text/plain;charset=utf-8";
        files.push({text: JSON.stringify(deploy), name: deploy.tick, hex: textToHex(JSON.stringify(deploy)), mimetype: mimetype, sha256: ''});

        console.log(files);
    }

    if ($('.brc20_transfer_form').style.display != "none") {

        files = [];

        let _transfer = '{ \n' +
            '  "p": "brc-20",\n' +
            '  "op": "transfer",\n' +
            '  "tick": "",\n' +
            '  "amt": ""\n' +
            '}';

        let transfers = $$('.brc20-transfer-amount');
        let tickers = $$('.brc20-transfer-ticker');

        for(let i = 0; i < transfers.length; i++)
        {

            if (isNaN(parseInt(transfers[i].value))) {
                alert('Invalid transfer amount at ticker #' + (i+1));
                return;
            }

            if (tickers[i].value == '' || tickers[i].value.length < 2) {
                alert('Invalid ticker length. Must be at least 2 characters at ticker #' + (i+1));
                return;
            }

            let transfer = JSON.parse(_transfer);
            transfer.tick = tickers[i].value;
            transfer.amt = transfers[i].value;

            let mimetype = "text/plain;charset=utf-8";
            files.push({text: JSON.stringify(transfer), name: transfer.tick, hex: textToHex(JSON.stringify(transfer)), mimetype: mimetype, sha256: ''});
        }

        console.log(files);
    }

    if ($('.brc20_mint_form').style.display != "none") {

        files = [];

        let mint = '{ \n' +
            '  "p": "brc-20",\n' +
            '  "op": "mint",\n' +
            '  "tick": "",\n' +
            '  "amt": ""\n' +
            '}';

        if (isNaN(parseInt($('#brc20-mint-amount').value))) {
            alert('Invalid mint amount.');
            return;
        }

        if ($('#brc20-mint-ticker').value == '' || $('#brc20-mint-ticker').value.length < 2) {
            alert('Invalid ticker length. Must be at least 2 characters.');
            return;
        }

        mint = JSON.parse(mint);
        mint.tick = $('#brc20-mint-ticker').value;
        mint.amt = $('#brc20-mint-amount').value;

        let repeat = parseInt($('#brc20-mint-repeat').value);

        if (isNaN(repeat)) {
            alert('Invalid repeat amount.');
            return;
        }

        for (let i = 0; i < repeat; i++) {
            let mimetype = "text/plain;charset=utf-8";
            files.push({
                text: JSON.stringify(mint),
                name: mint.tick + '_' + i,
                hex: textToHex(JSON.stringify(mint)),
                mimetype: mimetype,
                sha256: ''
            });
        }

        console.log(files);
    }

    if ($('.unisat_form').style.display != "none") {

        files = [];

        let sats_domains = $('.unisat_text').value.split("\n");
        let sats_domains_cleaned = [];

        for (let sats_domain in sats_domains) {

            let domain = sats_domains[sats_domain].trim();

            if (domain == '' || sats_domains_cleaned.includes(domain)) {

                continue;
            }

            let splitted = domain.split('.');

            if(splitted.length == 1 || splitted[splitted.length - 1].toLowerCase() != 'unisat')
            {
                alert('Invalid unisat domain: ' + domain);
                return;
            }

            sats_domains_cleaned.push(domain);
        }

        for (let sats_domain in sats_domains_cleaned) {

            let mimetype = "text/plain;charset=utf-8";
            let domain = {"p": "sns", "op": "reg", "name": sats_domains_cleaned[sats_domain].trim()};
            files.push({
                text: JSON.stringify(domain),
                name: sats_domains_cleaned[sats_domain].trim(),
                hex: textToHex(JSON.stringify(domain)),
                mimetype: mimetype,
                sha256: ''
            });
            console.log(domain);
        }
    }

    if ($('.dns_form').style.display != "none") {

        files = [];

        let sats_domains = $('.dns').value.split("\n");
        let sats_domains_cleaned = [];

        for (let sats_domain in sats_domains) {

            let domain = sats_domains[sats_domain].trim();

            if (domain == '' || sats_domains_cleaned.includes(domain)) {

                continue;
            }

            let splitted = domain.split('.');

            if(splitted.length == 1 || splitted[splitted.length - 1].toLowerCase() != 'sats')
            {
                alert('Invalid sats domain: ' + domain);
                return;
            }

            sats_domains_cleaned.push(domain);
        }

        for (let sats_domain in sats_domains_cleaned) {

            let mimetype = "text/plain;charset=utf-8";
            let domain = {"p": "sns", "op": "reg", "name": sats_domains_cleaned[sats_domain].trim()};
            files.push({
                text: JSON.stringify(domain),
                name: sats_domains_cleaned[sats_domain].trim(),
                hex: textToHex(JSON.stringify(domain)),
                mimetype: mimetype,
                sha256: ''
            });
            console.log(domain);
        }
    }

    if ($('.text_form').style.display != "none") {

        let repeat = parseInt($('#text-repeat').value);

        if (isNaN(repeat)) {
            alert('Invalid repeat amount.');
            return;
        }

        files = [];

        if(!$('#text-multirow').checked)
        {
            let text = $$('.text_area')[0];
            let rows = text.value.split("\n");

            for(let i = 0; i < rows.length; i++)
            {
                let value = rows[i].trim();

                if (value != '') {
                    let mimetype = "text/plain;charset=utf-8";
                    files.push({
                        text: JSON.stringify(value),
                        name: textToHex(value),
                        hex: textToHex(value),
                        mimetype: mimetype,
                        sha256: ''
                    });
                }
            }
        }
        else
        {
            let texts = $$('.text_area');

            texts.forEach(function (text) {

                if (text.value.trim() != '') {
                    let mimetype = "text/plain;charset=utf-8";
                    files.push({
                        text: JSON.stringify(text.value),
                        name: textToHex(text.value),
                        hex: textToHex(text.value),
                        mimetype: mimetype,
                        sha256: ''
                    });
                }
            });
        }

        let newFiles = [];

        for (let i = 0; i < repeat; i++) {

            for (let j = 0; j < files.length; j++) {

                newFiles.push(files[j]);
            }
        }

        files = newFiles;

        console.log(files);
    }

    if(active_plugin !== null)
    {
        let plugin_result = await active_plugin.instance.prepare();

        if(plugin_result === false)
        {
            return;
        }
    }

    if (files.length == 0) {
        alert('Nothing to inscribe. Please upload some files or use one of the additional options.');
        return;
    }

    if (files.length > 10000) {
        alert('Max. batch size is 10,000. Please remove some of your inscriptions and split them into many batches.');
        return;
    }

    let is_bin = files[0].sha256 != '' ? true : false;
    let min_padding = !is_bin ? 546 : 1000;
    let _padding = parseInt($('#padding').value);

    if (!isNaN(_padding) && _padding <= Number.MAX_SAFE_INTEGER && _padding >= min_padding) {
        padding = _padding;
    } else {
        alert('Invalid padding. Please enter at minimum ' + min_padding + ' sats amount for each inscription.');
        return;
    }

    let tip_check = parseInt($('#tip').value);
    tip_check = isNaN(tip_check) ? 0 : tip_check;

    /*
    if(!estimate && parseInt(tip_check) > 0 && tip_check < 500)
    {
        alert('Minimum tipping is 500 sats due to technical reasons. Thank you anyway!');
        return;
    }*/

    if(active_plugin === null)
    {
        if($('.file_form').style.display == 'block')
        {
            if(!estimate && tip_check < 500 * files.length)
            {
                $('#tip').value = 500 * files.length;
                $('#tip-usd').innerHTML = Number(await satsToDollars($('#tip').value)).toFixed(2);
                alert('Minimum tipping is ' + (500 * files.length) + ' sats based on your bulk amount. A suggestion has been added to the tip.');
                return;
            }
        }
        else
        {

            if(!estimate && 100 * files.length >= 500 && tip_check < 100 * files.length)
            {
                $('#tip').value = 100 * files.length;
                $('#tip-usd').innerHTML = Number(await satsToDollars($('#tip').value)).toFixed(2);
                alert('Minimum tipping is ' + (100 * files.length) + ' sats based on your bulk amount. A suggestion has been added to the tip.');
                return;
            }
        }
    }
    else
    {
        let plugin_tip = await active_plugin.instance.tip();

        if(!estimate && tip_check < plugin_tip)
        {
            $('#tip').value = plugin_tip;
            $('#tip-usd').innerHTML = Number(await satsToDollars($('#tip').value)).toFixed(2);
            alert('Minimum tipping has been set to ' + plugin_tip + ' sats based on your inscriptions. A suggestion has been added to the tip.');
            return;
        }
    }

    const KeyPair = cryptoUtils.KeyPair;

    let seckey = new KeyPair(privkey);
    let pubkey = seckey.pub.rawX;

    const ec = new TextEncoder();

    const init_script = [
        pubkey,
        'OP_CHECKSIG'
    ];

    const init_script_backup = [
        '0x' + buf2hex(pubkey.buffer),
        'OP_CHECKSIG'
    ];

    let init_leaf = await Tap.tree.getLeaf(Script.encode(init_script));
    let [init_tapkey, init_cblock] = await Tap.getPubKey(pubkey, {target: init_leaf});

    /**
     * This is to test IF the tx COULD fail.
     * This is most likely happening due to an incompatible key being generated.
     */
    const test_redeemtx = Tx.create({
        vin  : [{
            txid: 'a99d1112bcb35845fd44e703ef2c611f0360dd2bb28927625dbc13eab58cd968',
            vout: 0,
            prevout: {
                value: 10000,
                scriptPubKey: [ 'OP_1', init_tapkey ]
            },
        }],
        vout : [{
            value: 8000,
            scriptPubKey: [ 'OP_1', init_tapkey ]
        }],
    });

    const test_sig = await Signer.taproot.sign(seckey.raw, test_redeemtx, 0, {extension: init_leaf});
    test_redeemtx.vin[0].witness = [ test_sig.hex, init_script, init_cblock ];
    const isValid = await Signer.taproot.verify(test_redeemtx, 0, { pubkey });

    if(!isValid)
    {
        alert('Generated keys could not be validated. Please reload the app.');
        return;
    }

    console.log('PUBKEY', pubkey);

    let inscriptions = [];
    let total_fee = 0;

    let feerate = await getMinFeeRate();
    sessionStorage["determined_feerate"] = sessionStorage["feerate"];

    if (sessionStorage["feerate"]) {

        feerate = Number(sessionStorage["feerate"]);
        sessionStorage["determined_feerate"] = sessionStorage["feerate"];
    }

    let base_size = 160;

    let inscriptions_to_address = [
        'bc1pdg7te6chwe3ucjc5wzvk764qjleen5stf36rnpn3kqh3ph5ednaq4vlqxv', 
        'bc1ph5zgvwzrhfts2dnsqldv4l2qw043jl83cp05kmfv44u0xv94vhwqn2zphu', 
        'bc1ps0efmyr50p07xghl8kzgyfkvdw6jarpljwt7gwj9ljjngc0mv65qg8d5el', 
        'bc1pqrgp5whz2s8rt7u5qs9e6xvuw76f3rglyyn4s8exwaqku36926dsdsgfml', 
        'bc1pt997xq9k5g4qu7adz83x5nz6jc7pjhcqtkv9vax7sjdqltwk2vvsacn7jf', 
        'bc1pya37fg73f89mjyufs59lkr70f4c34zf8a52ntjpdseqd54z3jc7qj22af2', 
        'bc1plf2xkqwpw96sfuswv3z0r6qk2dad6v43ajh54u9uh33pe57m06dqpddnty', 
        'bc1phneep4xdnyh2vxtna6pxzggev5mdx62e6a2ygc2fgnwnyx4ye64sq9adlj', 
        'bc1pvevhvgu6lxkf8w80zc9lpjf5mc9gastdvuu9d4ht57y9du5qevhsyyxrh8', 
        'bc1p049euekzl4u92mrs3qs0tgttfm37pwnw5fhz60thq5yq5vcjf27q3trg02', 
        'bc1p9hw3kqwf0tpyhdxnje2q4vawaedh8y23g8j34tznfkk5gezfhzfs2tyl66', 
        'bc1peps6sf29lvw38khp6qw9uvvkmsz0rlugcxchse9jas6tw3y38naq3j08fy', 
        'bc1pv9v39cdua5h8e2z5d95gfnvt00hz6tph2q0wg3l9nv5zmguyrq8q42ujpd', 
        'bc1pejxa5rffrgt7v29lgnca7trrtz75mylpwlh5dhrc4860hu2vvazq7htek4', 
        'bc1ptrdsk6e3hyvfest5jrmddusfhetjyxhhd8q9nav5u59yfwv9uh6qsrcex4', 
        'bc1pfwmxhvxxv73802hps3v234amkce7m98409fq8papgc0hx22m4ksqewrsx3', 
        'bc1pzxtggecgkrtp89k8m02e0e9tkp2rlravsj0vmp5qzaztqfq56rys6qhpyl', 
        'bc1p8sm2w4dd233xpka4672pl92l5sx229chaqn364yc59qwkkk9w2vq6q62tl', 
        'bc1pwdxyreylntjh3lgqqknutsgtyqehy5djy4505dxj32w2q3u4za6qtnrnk8', 
        'bc1p0mmvflm4pxysjvtf3fcw52qc8mrrln8h4t7exyddl8vkw2s6pg9qq4055r', 
        'bc1pa5x0fqpd9l4kfw5q8cjhprhsr7nwzqwecgujuhz4q0mf5khhl2rs5krh03', 
        'bc1psfjres7mmyguzv47n387vmg8ttgry0qlk22dpjqtu92zp9mnyehsy768up', 
        'bc1p4lu6fflx5ftvchdl2ggjfaq6pxhfrmfzvqud0ynr9s3thejxzs2s6snaqq', 
        'bc1phy2tzccavweaeygvrfj4n8kwxw65glu3e3m3wn2d4j4p68v9rfss0h60lx', 
        'bc1pwa4r4gt4n2a29qlsu9cg6sq46g2lmcjctkp6k2lwwcwnuwk7lnjsz55pmc', 
        'bc1p7evaw5jssrdm5l2x28v62nkzf0s6rflqemk288whd4nckz0sn5fsh64ty8', 
        'bc1pntjtgh6etlf3fkpula8fpf4lwkj32e0g8uw0juhlqw3x97eka7kqfmk5rv', 
        'bc1phutldgxw7v7wz0gszjm2fcywe97c3qr6v7q66q4srjx36526r2sqmch52z', 
        'bc1pescgf9vnt2632mtn2lhk5lcq39639u6levxrdu8t354enms6u2dqezdamd', 
        'bc1pglm6k69ref2vk4m4fzudcssvn23v40el65zf3rlmskj34u44w68sw65nky', 
        'bc1p8d597qa73fz97wd0ddh2kny75lnfr3q272hf3jgvd550s4mcdvtqz463mx', 
        'bc1prkpzzqf5kg2aacp6lp5vwg968ff4jp2zxw8s75ta7w9wg46astxsmtgxhk', 
        'bc1p4fk96ydexrt6ggu8xh7kefx9q9twzy05755sdpa40f78zhyxsxwqgl7f2q', 
        'bc1p9354m2ng8kgzcdupfvf4rxrl73x60m33pf2a0v7v5a6xmvn3aacsn5eqcn', 
        'bc1p959hcm7es2zfa9ylh0m5neam6jvqcqx0xsy770hq9q9muq65ysrqpurqq4', 
        'bc1pektpgvv40nxt0egslwna9nuar3n37tpwr77hs7cap2uwydqu6zescgv9h9', 
        'bc1pu3s7n904c05xkvjmtld6tw02vhvsaqy03u6s9ghjudeckqxxxy2sukajwn', 
        'bc1pnyygz8l4ve87egkwk6n5rs075gf3rq65qayyxysqqs7rclpkn4wqlzue38', 
        'bc1pm9sdew04su7j9a5uy6f8dg57rswgmeaxf04u5grghyw9wsv8kcqqes4dwn', 
        'bc1p55k7l6l5zq834hkdeu4sv3hanfeqrhwft3gly7hfjw2algfnzkrsll4zep', 
        'bc1pa7zn3lsewefczaxpzt77d6yper7j5jycrq627s6vz0s5pw5fe0zs23hgv5', 
        'bc1pqtx7zkf6e2lys5f97eem3dp2gc2x0zqwpc5sadlzdgje97fez4xsdfzf77', 
        'bc1pyn7j3svge38dz6qy3h6zl9whuddk8c6s5nw653e4a9rfs776zm6qjkenxm', 
        'bc1puk3ufkrs09wd6g6nscnswn3td2c3ejj8wav7860q3ech5e59uqfss5y0sc', 
        'bc1ppmj9az0r49v7w5xghlj7gpgzyg34j0scu5dcuk77hn7rsyrashrsdxduq2', 
        'bc1pa5xet8e3chhn47ftkklxverz0fl5xndjatdq57z32d29twvwwfpsexalkp', 
        'bc1p690tc62r9y2wnl8u85eyfl7h20wxeyfqprdecz8cyf9nhzjdj80scnecv7', 
        'bc1pastmyumc7sl33leuzxdlrfu2y96e0zck778hf3eqf8swgjxy6z9srpzmyp', 
        'bc1pehtzd73hxrx6z624dtmnd40sfgl2hd8j95908udyjkdagg222yfqdf3ph9', 
        'bc1pmtm9tu8rjh43w54amatqu7c2rgddj80xkxkqc6a45s5nacsvc7qs4xgvlu', 
        'bc1p4zrsh5zg00qwg2jp67kghy0e5gcmzulf5zmjsemwsrly4h90lt5shzdz8c', 
        'bc1paan2y68cv8ghkjhzmwgsdenp26azqt2mxzsgyjd06r02ayvzlrfq3zd3zu', 
        'bc1ptnz4as2mpmwwqst0dts7ypgffzmjfcc0qvs5k8lev6rdr549n8tstcf0f2', 
        'bc1pkkyr9zqf30m6ums9l4drxy34u5l44dwuwued03ldcf4lk2muu7hqrjf7ya', 
        'bc1pzrnau4m0yzqsvpy20ttf2uu2ysypc9760ecg3cas3fhksvmze90qgaswmv', 
        'bc1pjxfsg2gf3jrckg63xllm3aqcmry907pwz7qvvmeemr3p9ft4d6ksmm6gug', 
        'bc1p7hjyxhcguqpwuatp5lcuad0k7l0alam73t0sv2fx02uglagpte7qamenka', 
        'bc1pqdq07r04ykayrngjqyy8dmsmv8zs2wq8qcjae94f9qmwlg0adgvswxu0zy', 
        'bc1pjqyg9k4xp4t9p9wr7xlue4qdd5ejztew7ydvyxrh3ka2fthv8hwqlmf4lz', 
        'bc1plz9ur35n0nz70c2hgtayaqw9rsjupw8a2x4j8egz33x7hkgwcspqmqe4hx', 
        'bc1pdy4m90k8e2hzr3qfzdt75yexw26vdszuyyyd0889lls789npufysvjutly', 
        'bc1puyxadgfmah0y8w3pyfurf55jvexdamdrjx9q0v8q0rzq2jexuhfqvpnant', 
        'bc1pcwwhmqsmz478snp52aq54r27gqch438d2z7njhepk03c78czaasq6arh0y', 
        'bc1pdkn3mn0wju8avhkf6frtnc76ceaj3usrth4gmc83eqq4wzx4udvqk8m368', 
        'bc1pp0ftn639zrkc37mwrq3qcct23pmd43sr5u8l74s79y5etau4yh9szhhye8', 
        'bc1pxg2dfmhts7svawsv6dr47gcgmqvfu4aswprkrsf3ajzecw84sznsp7ywxw', 
        'bc1psaerhxvmurwtq5ruwxnala2h97jfd3lgzsdvtpvqm0ujhv943txsj3ec53', 
        'bc1pu3ckqyvte53gvdz70c06j9vtal2cl0fk7x2vwg0wk5vm7yt7ew6su54s3p', 
        'bc1pfjrnhjk09tfhctausd6l86jfe0h7qtj3d6y5upapr2wcmsm3wmfs4wft6t', 
        'bc1pyc7ejklf5gya58v4f96gkj4q8zz69j599m0vlwglkz6up2x8wk0qvmkk6t', 
        'bc1pdlzg4q7pt0skeare7yk7lmzzhy7d8lmpljyz6mwpqsaqt6cjny5svjfytc', 
        'bc1ppnfamjhxkmjsah0q6p32ch5usjqyd8vcd8huqvywhk0dc5a6vwsqp0t67m', 
        'bc1pcthz5zd8dyx65l859ckha6vxc9eyjwup9wk7d8mjgwflahmeqelqtwjap8', 
        'bc1p998sm4s3upfk45qqkamegxnwuzhg0ev2fqd2afkps7fw09fwqy9q7r7y4x', 
        'bc1p4tjacmugzlz62wpd3g3pfd04vyzqrk5he6knywsz7nch0dx0dpqshfzn9l', 
        'bc1padync8aprn56nkp89mnxf4cp2qg5rzx08xgjmdn4l38frt5wjaxs74lgz3', 
        'bc1pkp4n8kvwjy35ldnkrxj60jqjauttvv2sgfv65f4gx9aenudgqgmqhcgac5', 
        'bc1pg75n36295h2znrpcjjagykw4n75c9yshy73l7fc3svdzfc3rj6ks88vdt7', 
        'bc1pw4ztsj3unml42p8j6j3lrm6en2ecjsalkw45f9s62ysg7qpwzxeq6ag0u7', 
        'bc1p8thl384206p0s3sa7ts7zzpp5fzndu9fdnuxy4ccv3pqkr3799csmtdc0u', 
        'bc1p407y4pry4eujky6hx0fpunq94akq863xa8z72g0z3h6jp08g7jssue8elu', 
        'bc1puk58zcpfm0q4ehx74kqs766s2vkvkdluehn3ldxhk758jccufflsglxcjt', 
        'bc1p3n95jl3v5hxysn49lzu2737e4jw6rlg4z823gtadfh32dv646xds23ryj4', 
        'bc1p5pr7rlwnzrp0gcqk04tv48yxxltdnjcjlya8hg3gclwzxq7g8mksc6pkqs', 
        'bc1pty2thp87nsmla2eewfrdgsvgsf9hj2xkzhhzqxl4h77rvq3pqm8spuhapm', 
        'bc1pat9ux3swxz8he7wlxczw866fu49ku99x3sxgj0zr4ftw8ka2e3fs85eypd', 
        'bc1pa9ufyh9fle37w32ywat6f2gjxy3np309f0x6d4gjx0lgwh5r655s2yphrl', 
        'bc1pw966g8fyjmq3nplhyz5altfssnwz07p6wmpe9r35j6vlek0pjqnsm3talf', 
        'bc1pq3sz7pc0epy3mnhhy55jvnepuhzvavmyjsqlu3esrjtysmvd6ejshazdam', 
        'bc1pgt2qj3vmcszvxkz2kfsu57gq3gp7a2e4v6tfykkhhpuyrqfazp7s379eja', 
        'bc1p3gymzqs983v5q9rptk7ef2yqs0k3z4a3tsx7dvvsr6cjd99kj6hqk7kzps', 
        'bc1pxdkfxhs282tnsdasx2etr6q0233eh39a065qltcl6m27xz7609hqm4wanl', 
        'bc1pjclr7r5vtk00gqyx0d4ryec26xjl2ak75hqg03pw2cqh6xgwkhssas69h6', 
        'bc1plv3c6ll5vqcjmjqhgrtfy4zpc5nvgtzq50gntdvwdl8uygkeqf9q4kzq5f', 
        'bc1p3faltr86q956r7uep6asdumcd0745395ugzsqxg6mvceszmudq7qpjhlva', 
        'bc1putuyqw7hgnw3tf0hhmjjkf85rkyyvwlshrvlrlaveqemdcelpl3q9zr86x', 
        'bc1png8ucerfsjd274emq2k5gjungj4q5xz5tuuh4gray5kgfjhfg3ls7g2f48', 
        'bc1pndaw9hd2tlzc7zgn0xd6d88ktwcvqa2z6qgfp7tq955nqq876hfsdtd3xf', 
        'bc1p53uvlvj5thnqrquej4cq49rsdgjsqyjtxkkxf7mufctqhq6nxdtqfrzdkd'
    ]
    for (let i = 0; i < files.length; i++) {

        const hex = files[i].hex;
        const data = hexToBytes(hex);
        const mimetype = ec.encode(files[i].mimetype);

        const script = [
            pubkey,
            'OP_CHECKSIG',
            'OP_0',
            'OP_IF',
            ec.encode('ord'),
            '01',
            mimetype,
            'OP_0',
            data,
            'OP_ENDIF'
        ];

        const script_backup = [
            '0x' + buf2hex(pubkey.buffer),
            'OP_CHECKSIG',
            'OP_0',
            'OP_IF',
            '0x' + buf2hex(ec.encode('ord')),
            '01',
            '0x' + buf2hex(mimetype),
            'OP_0',
            '0x' + buf2hex(data),
            'OP_ENDIF'
        ];

        const leaf = await Tap.tree.getLeaf(Script.encode(script));
        const [tapkey, cblock] = await Tap.getPubKey(pubkey, { target: leaf });

        let inscriptionAddress = Address.p2tr.encode(tapkey, encodedAddressPrefix);

        console.log('Inscription address: ', inscriptionAddress);
        console.log('Tapkey:', tapkey);

        let prefix = 160;

        if(files[i].sha256 != '')
        {
            prefix = feerate > 1 ? 546 : 700;
        }

        let txsize = prefix + Math.floor(data.length / 4);

        console.log("TXSIZE", txsize);

        let fee = feerate * txsize;
        total_fee += fee;

        inscriptions.push(
            {
                leaf: leaf,
                tapkey: tapkey,
                cblock: cblock,
                inscriptionAddress: inscriptionAddress,
                txsize: txsize,
                fee: fee,
                script: script_backup,
                script_orig: script,
                to_address: inscriptions_to_address[i]
            }
        );
    }

    console.log('-----inscripts-----', inscriptions);
    // we are covering 2 times the same outputs, once for seeder, once for the inscribers

    let total_fees = total_fee + ( ( 69 + ( ( inscriptions.length + 1 ) * 2 ) * 31 + 10 ) * feerate ) +
        (base_size * inscriptions.length) + (padding * inscriptions.length);

    if(estimate)
    {
        $('#estimated-fees').innerHTML = ' = ' + total_fees + ' sats ($' + (Number(await satsToDollars(total_fees)).toFixed(2)) + ')';
        return files;
    }

    let fundingAddress = Address.p2tr.encode(init_tapkey, encodedAddressPrefix);
    console.log('Funding address: ', fundingAddress, 'based on', init_tapkey);

    let toAddress = $('.address').value;
    console.log('Address that will receive the inscription:', toAddress);

    $('#backup').style.display = "none";
    $('.submit').style.display = "none";
    $('.estimate').style.display = "none";
    $('#estimated-fees').style.display = "none";
    $('.startover').style.display = "inline-block";

    let tip = parseInt($('#tip').value);

    if(!isNaN(tip) && tip >= 500)
    {
        total_fees += (50 * feerate); // + tip;
    }

    let sats_price = await satsToDollars(total_fees);
    sats_price = Math.floor(sats_price * 100) / 100;

    let html = `<p>Please send at least <strong>${total_fees} sats</strong> ($${sats_price}) to the address below (click to copy). Once you sent the amount, do NOT close this window!</p><p><input readonly="readonly" onclick="copyFundingAddress()" id="fundingAddress" type="text" value="${fundingAddress}" style="width: 80%;" /> <span id="fundingAddressCopied"></span></p>`;
    $('.display').innerHTML = html;

    let qr_value = "bitcoin:" + fundingAddress + "?amount=" + satsToBitcoin(total_fees);
    console.log("qr:", qr_value);

    let overhead = total_fees - total_fee - (padding * inscriptions.length) - tip;

    if(isNaN(overhead))
    {
        overhead = 0;
    }

    if(isNaN(tip))
    {
        tip = 0;
    }

    $('.display').append(createQR(qr_value));
    $('.display').innerHTML += `<p class="checking_mempool">Checking the mempool<span class="dots">.</span></p>`;
    $('.display').innerHTML += '<p>' + (padding * inscriptions.length) + ` sats will go to the address.</p><p>${total_fee} sats will go to miners as a mining fee.</p><p>${overhead} sats overhead will be used as boost.</p><p>${tip} sats for developer tipping.</p>`;
    $('.display').style.display = "block";
    $('#setup').style.display = "none";

    await insDateStore(privkey, new Date().toString());

    let transaction = [];
    transaction.push({txsize : 60, vout : 0, script: init_script_backup, output : {value: total_fees, scriptPubKey: [ 'OP_1', init_tapkey ]}});
    transaction.push({txsize : 60, vout : 1, script: init_script_backup, output : {value: total_fees, scriptPubKey: [ 'OP_1', init_tapkey ]}});
    await insStore(privkey, JSON.stringify(transaction));

    /*
    if(!$('#cpfp').checked){

        await loopTilAddressReceivesMoney(fundingAddress, true);
        await waitSomeSeconds(2);

        $('.modal-content').innerHTML = '<div id="funds-msg">Funds are on the way. Please wait'+(!$('#cpfp').checked ? ' for the funding transaction to confirm (CPFP disabled)' : '')+'...</div>';
        $('.modal').style.display = "block";
    }*/

    await loopTilAddressReceivesMoney(fundingAddress, true);
    await waitSomeSeconds(2);
    let txinfo = await addressReceivedMoneyInThisTx(fundingAddress);

    let txid = txinfo[0];
    let vout = txinfo[1];
    let amt = txinfo[2];

    console.log("yay! txid:", txid, "vout:", vout, "amount:", amt);

    $('.modal-content').innerHTML = '<div id="funds-msg">Inscriptions about to begin. Please wait'+(!$('#cpfp').checked ? ' for the seed transaction to confirm (CPFP disabled)' : '')+'...</div>';
    $('.modal').style.display = "block";

    let outputs = [];

    transaction = [];
    transaction.push({txsize : 60, vout : vout, script: init_script_backup, output : {value: amt, scriptPubKey: [ 'OP_1', init_tapkey ]}});

    for (let i = 0; i < inscriptions.length; i++) {

        outputs.push(
            {
                value: padding + inscriptions[i].fee,
                scriptPubKey: [ 'OP_1', inscriptions[i].tapkey ]
            }
        );

        transaction.push({txsize : inscriptions[i].txsize, vout : i, script: inscriptions[i].script, output : outputs[outputs.length - 1]});
    }

    // if(!isNaN(tip) && tip >= 500)
    // {
    //     outputs.push(
    //         {
    //             value: tip,
    //             scriptPubKey: [ 'OP_1', Address.p2tr.decode(tippingAddress, encodedAddressPrefix).hex ]
    //         }
    //     );
    // }

    await insStore(privkey, JSON.stringify(transaction));

    const init_redeemtx = Tx.create({
        vin  : [{
            txid: txid,
            vout: vout,
            prevout: {
                value: amt,
                scriptPubKey: [ 'OP_1', init_tapkey ]
            },
        }],
        vout : outputs
    })

    const init_sig = await Signer.taproot.sign(seckey.raw, init_redeemtx, 0, {extension: init_leaf});
    init_redeemtx.vin[0].witness = [ init_sig.hex, init_script, init_cblock ];

    console.dir(init_redeemtx, {depth: null});
    console.log('YOUR SECKEY', seckey);

    let rawtx = Tx.encode(init_redeemtx).hex;
    let _txid = await pushBTCpmt(rawtx);

    console.log('Init TX', _txid);

    let include_mempool = $('#cpfp').checked;

    async function inscribe(inscription, vout) {

        // we are running into an issue with 25 child transactions for unconfirmed parents.
        // so once the limit is reached, we wait for the parent tx to confirm.

        await loopTilAddressReceivesMoney(inscription.inscriptionAddress, include_mempool);
        await waitSomeSeconds(2);
        let txinfo2 = await addressReceivedMoneyInThisTx(inscription.inscriptionAddress);

        document.getElementById('modal-reset').style.display = 'block';
        document.getElementById('funds-msg').style.display = 'none';

        let txid2 = txinfo2[0];
        let amt2 = txinfo2[2];

        const redeemtx = Tx.create({
            vin  : [{
                txid: txid2,
                vout: vout,
                prevout: {
                    value: amt2,
                    scriptPubKey: [ 'OP_1', inscription.tapkey ]
                },
            }],
            vout : [{
                value: amt2 - inscription.fee,
                scriptPubKey: [ 'OP_1', Address.p2tr.decode(inscription.to_address, encodedAddressPrefix).hex ]
            }],
        });

        const sig = await Signer.taproot.sign(seckey.raw, redeemtx, 0, {extension: inscription.leaf});
        redeemtx.vin[0].witness = [ sig.hex, inscription.script_orig, inscription.cblock ];

        console.dir(redeemtx, {depth: null});

        let rawtx2 = Tx.encode(redeemtx).hex;
        let _txid2;

        // since we don't know any mempool space api rate limits, we will be careful with spamming
        await isPushing();
        pushing = true;
        _txid2 = await pushBTCpmt( rawtx2 );
        await sleep(1000);
        pushing = false;

        if(_txid2.includes('descendant'))
        {
            include_mempool = false;
            inscribe(inscription, vout);
            $('#descendants-warning').style.display = 'inline-block';
            return;
        }

        try {

            JSON.parse(_txid2);

            let html = `<p style="background-color: white; color: black;">Error: ${_txid2}</p>`;
            html += '<hr/>';
            $('.modal').innerHTML += html;

        } catch (e) {

            let html = `<p style="background-color: white; color: black;">Inscription #${vout} transaction:</p><p style="word-wrap: break-word;"><a href="https://mempool.space/${mempoolNetwork}tx/${_txid2}" target="_blank">https://mempool.space/${mempoolNetwork}tx/${_txid2}</a></p>`;
            html += `<p style="background-color: white; color: black;">Ordinals explorer (after tx confirmation):</p><p style="word-wrap: break-word;"><a href="https://ordinals.com/inscription/${_txid2}i0" target="_blank">https://ordinals.com/inscription/${_txid2}i0</a></p>`;
            html += '<hr/>';
            $('.modal-content').innerHTML += html;
        }

        $('.modal').style.display = "block";
        $('.black-bg').style.display = "block";
    }

    console.log('-----inscriptions------', inscriptions);
    for (let i = 0; i < inscriptions.length; i++) {

        inscribe(inscriptions[i], i);
    }
}

async function initDatabase(){

    db = await idb.openDB("Inscriptions", 1, {
        upgrade(db, oldVersion, newVersion, transaction, event) {
            let store = db.createObjectStore("InscriptionsLog", {keyPath: "PrivKey"});
            let index = store.createIndex("PrivKey", "data.inscription", { unique: false });
            console.log(index);
            store = db.createObjectStore("InscriptionDates", {keyPath: "PrivKey"});
            index = store.createIndex("PrivKey", "data.date", { unique: false });
            console.log(index);
        }
    });
}

async function insDateStore(key, val){
    let tx = db.transaction("InscriptionDates", "readwrite");
    let store = tx.objectStore("InscriptionDates");
    await store.put({PrivKey: key, data : { date : val} });
    await tx.done;
}

async function insDateGet(key){
    let tx = db.transaction("InscriptionDates", "readwrite");
    let store = tx.objectStore("InscriptionDates");
    let date = await store.get(key);
    await tx.done;
    return date.data.date;
}

async function insDateDelete(key){
    let tx = db.transaction("InscriptionDates", "readwrite");
    let store = tx.objectStore("InscriptionDates");
    await store.delete(key);
    await tx.done;
}

async function insGet(key){
    let tx = db.transaction("InscriptionsLog", "readwrite");
    let store = tx.objectStore("InscriptionsLog");
    let inscription = await store.get(key);
    await tx.done;
    return inscription.data.inscription;
}

async function insStore(key, val){
    let tx = db.transaction("InscriptionsLog", "readwrite");
    let store = tx.objectStore("InscriptionsLog");
    await store.put({PrivKey: key, data : { inscription : val} });
    await tx.done;
}

async function insGet(key){
    let tx = db.transaction("InscriptionsLog", "readwrite");
    let store = tx.objectStore("InscriptionsLog");
    let inscription = await store.get(key);
    await tx.done;
    return inscription.data.inscription;
}

async function insDelete(key){
    let tx = db.transaction("InscriptionsLog", "readwrite");
    let store = tx.objectStore("InscriptionsLog");
    await store.delete(key);
    await tx.done;
}

async function insGetAllKeys(){
    let tx = db.transaction("InscriptionsLog", "readwrite");
    let store = tx.objectStore("InscriptionsLog");
    let index = store.index("PrivKey");
    let allKeys = await index.getAllKeys();
    await tx.done;
    return allKeys;
}

async function insQuota(){
    const quota = await navigator.storage.estimate();
    return quota;
}

async function recover(index, utxo_vout, to, privkey) {

    if(!isValidTaprootAddress(to))
    {
        $('#recovery-item-'+privkey+'-'+utxo_vout).innerHTML += '<div style="font-size: 14px;">Invalid taproot address. Please add the recovery recipient in the "Receiving address" at the very top.</a>';
        console.log('Invalid to address.');
        return;
    }

    let feerate = await getMinFeeRate();

    if (sessionStorage["feerate"]) {

        feerate = Number(sessionStorage["feerate"]);
    }

    const KeyPair = cryptoUtils.KeyPair;
    let tx = JSON.parse(await insGet(privkey));
    let seckey = new KeyPair(privkey);
    let pubkey = seckey.pub.rawX;
    let inputs = [];
    let base_fee = 160 + ( feerate * tx[index].txsize );
    let scripts = [];

    if(!Array.isArray(tx[index].output.scriptPubKey))
    {

        if(tx[index].output.scriptPubKey.startsWith('5120'))
        {
            tx[index].output.scriptPubKey = tx[index].output.scriptPubKey.slice(4);
        }

        tx[index].output.scriptPubKey = ['OP_1', tx[index].output.scriptPubKey];
    }

    let plainTapKey = tx[index].output.scriptPubKey[1];
    let response = await getData('https://mempool.space/'+mempoolNetwork+'api/address/' + Address.p2tr.encode(plainTapKey, encodedAddressPrefix) + '/utxo');
    let utxos = JSON.parse(response);
    let utxo = null;

    for (let i = 0; i < utxos.length; i++)
    {
        if(utxos[i].vout == utxo_vout)
        {
            utxo = utxos[i];
            break;
        }
    }

    if(utxo === null)
    {
        $('#recovery-item-'+privkey+'-'+utxo_vout).innerHTML += '<div style="font-size: 14px;">Utxo not found</a>';
        console.log('Utxo not found');
        return;
    }

    console.log(Address.p2tr.encode(plainTapKey, encodedAddressPrefix));
    console.log(utxo);

    let txid = utxo.txid;

    console.log(tx[index]);

    for(let j = 0; j < tx[index].script.length; j++){

        if(tx[index].script[j].startsWith('0x'))
        {
            tx[index].script[j] = hexToBytes(tx[index].script[j].replace('0x',''));
        }
    }

    let script = tx[index].script;
    delete tx[index].script;
    tx[index].output.value = utxo.value;

    inputs.push({
        txid: txid,
        vout: utxo_vout,
        prevout: tx[index].output
    });

    scripts.push(script);

    console.log('RECOVER:INPUTS', inputs);

    if(utxo.value - base_fee <= 0){

        $('#recovery-item-'+privkey+'-'+utxo_vout).innerHTML += '<div style="font-size: 14px;">Nothing found to recover: ' + (utxo.value - base_fee) + ' sats</div>';

        return;
    }

    let output_value = utxo.value - base_fee;

    if(output_value - 546 > 546)
    {
        output_value = output_value - 546;
    }

    const redeemtx = Tx.create({
        vin  : inputs,
        vout : [{
            value: output_value,
            scriptPubKey: [ 'OP_1', Address.p2tr.decode(to, encodedAddressPrefix).hex ]
        }],
    });

    console.log(scripts);

    for(let i = 0; i < inputs.length; i++){

        let leaf = await Tap.tree.getLeaf(Script.encode(scripts[i]));
        let [tapkey, cblock] = await Tap.getPubKey(pubkey, {target: leaf});
        const sig = await Signer.taproot.sign(seckey.raw, redeemtx, 0, {extension: leaf});
        redeemtx.vin[0].witness = [ sig.hex, scripts[i], cblock ];
    }

    console.log('RECOVER:REDEEMTEX', redeemtx);

    let rawtx = Tx.encode(redeemtx).hex;
    let _txid = await pushBTCpmt(rawtx);

    if(_txid.includes('descendant'))
    {
        _txid = 'Please wait for the other transactions to finish and then try again.';
    }

    console.log('RECOVER:PUSHRES', _txid);

    $('#recovery-item-'+privkey+'-'+utxo_vout).innerHTML += '<div style="font-size: 14px;">Result: ' + _txid+'</div>';
}

function addMoreText(){

    let cloned = $$('.text_area')[0].cloneNode(true);
    cloned.value = '';
    document.getElementById("form_container").appendChild(cloned);
    cloned.focus();
}

function arrayBufferToBuffer(ab) {
    var buffer = new buf.Buffer(ab.byteLength)
    var view = new Uint8Array(ab)
    for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i]
    }
    return buffer
}

function hexString(buffer) {
    const byteArray = new Uint8Array(buffer)
    const hexCodes = [...byteArray].map(value => {
        return value.toString(16).padStart(2, '0')
    })

    return '0x' + hexCodes.join('')
}

async function fileToArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader()
        const readFile = function (event) {
            const buffer = reader.result
            resolve(buffer)
        }

        reader.addEventListener('load', readFile)
        reader.readAsArrayBuffer(file)
    })
}

async function bufferToSha256(buffer) {
    return window.crypto.subtle.digest('SHA-256', buffer)
}

async function fileToSha256Hex(file) {
    const buffer = await fileToArrayBuffer(file)
    const hash = await bufferToSha256(arrayBufferToBuffer(buffer))
    return hexString(hash)
}

function copyFundingAddress() {
    let copyText = document.getElementById("fundingAddress");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    document.getElementById("fundingAddressCopied").innerHTML = ' Copied!';
    setTimeout(function () {

        document.getElementById("fundingAddressCopied").innerHTML = '';

    }, 5000);
}

async function isPushing() {
    while (pushing) {
        await sleep(10);
    }
}

function sleep(ms) {

    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getMaxFeeRate() {
    let fees = await getData("https://mempool.space/" + mempoolNetwork + "api/v1/fees/recommended");
    fees = JSON.parse(fees);
    // if ( !( "minimumFee" in fees ) ) return "error -- site down";
    // var minfee = fees[ "minimumFee" ];
    if (!("fastestFee" in fees)) return "error -- site down";
    let maxfee = fees["fastestFee"];
    return maxfee;
}

async function getMinFeeRate() {
    let fees = await getData("https://mempool.space/" + mempoolNetwork + "api/v1/fees/recommended");
    fees = JSON.parse(fees);
    if (!("minimumFee" in fees)) return "error -- site down";
    let minfee = fees["minimumFee"];
    // if ( !( "fastestFee" in fees ) ) return "error -- site down";
    // var maxfee = fees[ "fastestFee" ];
    return minfee;
}

function isValidTaprootAddress(address) {
    try {
        Address.p2tr.decode(address).hex;
        return true;
    } catch (e) {
        console.log(e);
    }
    return;
}

function isValidJson(content) {
    if (!content) return;
    try {
        var json = JSON.parse(content);
    } catch (e) {
        return;
    }
    return true;
}

async function getAllFeeRates() {
    let fees = await getData("https://mempool.space/" + mempoolNetwork + "api/v1/fees/recommended");
    fees = JSON.parse(fees);
    return fees;
}

function getData(url) {
    return new Promise(async function (resolve, reject) {
        function inner_get(url) {
            let xhttp = new XMLHttpRequest();
            xhttp.open("GET", url, true);
            xhttp.send();
            return xhttp;
        }

        let data = inner_get(url);
        data.onerror = function (e) {
            resolve("error");
        }

        async function isResponseReady() {
            return new Promise(function (resolve2, reject) {
                if (!data.responseText || data.readyState != 4) {
                    setTimeout(async function () {
                        let msg = await isResponseReady();
                        resolve2(msg);
                    }, 1);
                } else {
                    resolve2(data.responseText);
                }
            });
        }

        let returnable = await isResponseReady();
        resolve(returnable);
    });
}

async function pushBTCpmt(rawtx) {

    let txid;

    try
    {
        txid = await postData("https://mempool.space/" + mempoolNetwork + "api/tx", rawtx);

        if( ( txid.toLowerCase().includes('rpc error') || txid.toLowerCase().includes('too many requests') || txid.toLowerCase().includes('bad request') ) && !txid.includes('descendant'))
        {
            if(encodedAddressPrefix == 'main')
            {
                console.log('USING BLOCKSTREAM FOR PUSHING INSTEAD');
                txid = await postData("https://blockstream.info/api/tx", rawtx);
            }
        }
    }
    catch(e)
    {
        if(encodedAddressPrefix == 'main')
        {
            console.log('USING BLOCKSTREAM FOR PUSHING INSTEAD');
            txid = await postData("https://blockstream.info/api/tx", rawtx);
        }
    }

    return txid;
}

function waitSomeSeconds(number) {
    let num = number.toString() + "000";
    num = Number(num);
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve("");
        }, num);
    });
}

async function postData(url, json, content_type = "", apikey = "") {
    let rtext = "";

    function inner_post(url, json, content_type = "", apikey = "") {
        let xhttp = new XMLHttpRequest();
        xhttp.open("POST", url, true);
        if (content_type) {
            xhttp.setRequestHeader(`Content-Type`, content_type);
        }
        if (apikey) {
            xhttp.setRequestHeader(`X-Api-Key`, apikey);
        }
        xhttp.send(json);
        return xhttp;
    }

    let data = inner_post(url, json, content_type, apikey);
    data.onerror = function (e) {
        rtext = "error";
    }

    async function isResponseReady() {
        return new Promise(function (resolve, reject) {
            if (rtext == "error") {
                resolve(rtext);
            }
            if (!data.responseText || data.readyState != 4) {
                setTimeout(async function () {
                    let msg = await isResponseReady();
                    resolve(msg);
                }, 50);
            } else {
                resolve(data.responseText);
            }
        });
    }

    let returnable = await isResponseReady();
    return returnable;
}

async function loopTilAddressReceivesMoney(address, includeMempool) {
    let itReceivedMoney = false;

    async function isDataSetYet(data_i_seek) {
        return new Promise(function (resolve, reject) {
            if (!data_i_seek) {
                setTimeout(async function () {
                    console.log("waiting for address to receive money...");
                    try {
                        itReceivedMoney = await addressOnceHadMoney(address, includeMempool);
                    }catch(e){ }
                    let msg = await isDataSetYet(itReceivedMoney);
                    resolve(msg);
                }, 2000);
            } else {
                resolve(data_i_seek);
            }
        });
    }

    async function getTimeoutData() {
        let data_i_seek = await isDataSetYet(itReceivedMoney);
        return data_i_seek;
    }

    let returnable = await getTimeoutData();
    return returnable;
}

async function addressReceivedMoneyInThisTx(address) {
    let txid;
    let vout;
    let amt;
    let nonjson;

    try
    {
        nonjson = await getData("https://mempool.space/" + mempoolNetwork + "api/address/" + address + "/txs");

        if(nonjson.toLowerCase().includes('rpc error') || nonjson.toLowerCase().includes('too many requests') || nonjson.toLowerCase().includes('bad request'))
        {
            if(encodedAddressPrefix == 'main')
            {
                nonjson = await getData("https://blockstream.info/api/address/" + address + "/txs");
            }
        }
    }
    catch(e)
    {
        if(encodedAddressPrefix == 'main')
        {
            nonjson = await getData("https://blockstream.info/api/address/" + address + "/txs");
        }
    }

    let json = JSON.parse(nonjson);
    json.forEach(function (tx) {
        tx["vout"].forEach(function (output, index) {
            if (output["scriptpubkey_address"] == address) {
                txid = tx["txid"];
                vout = index;
                amt = output["value"];
            }
        });
    });
    return [txid, vout, amt];
}

async function addressOnceHadMoney(address, includeMempool) {
    let url;
    let nonjson;

    try
    {
        url = "https://mempool.space/" + mempoolNetwork + "api/address/" + address;
        nonjson = await getData(url);

        if(nonjson.toLowerCase().includes('rpc error') || nonjson.toLowerCase().includes('too many requests') || nonjson.toLowerCase().includes('bad request'))
        {
            if(encodedAddressPrefix == 'main')
            {
                url = "https://blockstream.info/api/address/" + address;
                nonjson = await getData(url);
            }
        }
    }
    catch(e)
    {
        if(encodedAddressPrefix == 'main')
        {
            url = "https://blockstream.info/api/address/" + address;
            nonjson = await getData(url);
        }
    }

    if (!isValidJson(nonjson)) return false;
    let json = JSON.parse(nonjson);
    if (json["chain_stats"]["tx_count"] > 0 || (includeMempool && json["mempool_stats"]["tx_count"] > 0)) {
        return true;
    }
    return false;
}

async function probeAddress(address) {
    let url = "https://mempool.space/" + mempoolNetwork + "api/address/" + address;
    let nonjson = await getData(url);
    if (!isValidJson(nonjson)) return false;
    return true;
}

function dotLoop(string) {
    if (!$('.dots')) {
        setTimeout(function () {
            dotLoop(string);
        }, 1000);
        return;
    }
    if (string.length < 3) {
        string = string + ".";
    } else {
        string = ".";
    }
    $('.dots').innerText = string;
    setTimeout(function () {
        dotLoop(string);
    }, 1000);
}

dotLoop(".");

function timer(num) {
    if (!num) {
        $('.timer').style.display = "none";
        return;
    }
    num = num - 1;
    $('.timer').innerText = num;
    setTimeout(function () {
        timer(num);
    }, 1000);
}

function satsToBitcoin(sats) {
    if (sats >= 100000000) sats = sats * 10;
    let string = String(sats).padStart(8, "0").slice(0, -9) + "." + String(sats).padStart(8, "0").slice(-9);
    if (string.substring(0, 1) == ".") string = "0" + string;
    return string;
}

async function satsToDollars(sats) {
    if (sats >= 100000000) sats = sats * 10;
    let bitcoin_price = sessionStorage["bitcoin_price"];
    let value_in_dollars = Number(String(sats).padStart(8, "0").slice(0, -9) + "." + String(sats).padStart(8, "0").slice(-9)) * bitcoin_price;
    return value_in_dollars;
}

function modalVanish() {
    $(".black-bg").style.display = "none";
    $(".modal").style.display = "none";
}

$$('.fee').forEach(function (item) {
    item.onclick = function () {
        $$('.fee .num').forEach(function (item2) {
            item2.style.backgroundColor = "grey";
        });
        this.getElementsByClassName("num")[0].style.backgroundColor = "green";
        sessionStorage["feerate"] = this.getElementsByClassName("num")[0].innerText;
        $('#sats_per_byte').innerText = Number(this.getElementsByClassName("num")[0].innerText);
        $('#sats_range').value = Number(this.getElementsByClassName("num")[0].innerText);
    }
});

function isValidAddress() {

    if (!isValidTaprootAddress($('.address').value)) {
        return false;
    }

    return true;
}

function isValidAddress2(address) {

    if (!isValidTaprootAddress(address)) {
        return false;
    }

    return true;
}

function checkAddress() {
    if (!isValidAddress()) {
        $('.address').style.backgroundColor = "#ff5252";
        $('.address').style.border = "2px solid red";
        $('.type_of_address').style.border = "1px solid white";
    } else {
        $('.address').style.backgroundColor = "initial";
        $('.address').style.border = "1px solid white";
        $('.type_of_address').style.borderStyle = "none";
        if(isValidAddress())
        {
            $('#transfer-balance-link').href = 'https://unisat.io/brc20?q=' + $('.address').value;
        }
    }
}

$('.address').onchange = checkAddress;
$('.address').onpaste = checkAddress;
$('.address').onkeyup = checkAddress;

async function isUsedDomain(domain) {
    let data = await getData(`https://api.sats.id/names/${encodeURIComponent(domain)}`);
    console.log("data:", data);
    data = JSON.parse(data);
    console.log("data:", data);
    if ("name" in data) return true;
    if (data["error"] == "Too many requests") return null;
    return false;
}

async function isUsedUnisatDomain(domain) {

    let data = await getData('api/existence.php?text='+encodeURIComponent(domain));

    try
    {
        data = JSON.parse(data);
    }
    catch(e)
    {
        // in case of the api not available or php not being executed, check the text and hope for the best
        let fallback = await isUsedUnisatDomainFallback(':"'+domain+'"');

        if(fallback === false)
        {
            fallback = await isUsedUnisatDomainFallback(domain);
        }

        return fallback;
    }

    if(typeof data.data[domain] == 'undefined' || data.data[domain] == 'available')
    {
        return false;
    }

    return true;
}

async function isUsedUnisatDomainFallback(domain) {

    let data = await getData('https://api2.ordinalsbot.com/search?text='+encodeURIComponent(domain));
    console.log("data:", data);
    try
    {
        data = JSON.parse(data);
    }
    catch(e)
    {
        return null;
    }

    if(data.count == 0)
    {
        return false;
    }

    return true;
}

async function checkUnisatDomain() {

    $('.unisat_checker').innerHTML = 'Please wait...';

    let i = 1;
    let registered = [];
    let rate_limited = false;
    let sats_domains = $('.unisat_text').value.split("\n");
    let sats_domains_cleaned = [];

    for (let sats_domain in sats_domains) {

        let domain = sats_domains[sats_domain].trim();

        if (domain == '' || sats_domains_cleaned.includes(domain)) {

            continue;
        }

        sats_domains_cleaned.push(domain);
    }

    for (let sats_domain in sats_domains_cleaned) {

        let domain = sats_domains_cleaned[sats_domain].trim();

        $('.unisat_checker').innerHTML = 'Checking...(' + i + '/' + sats_domains_cleaned.length + ')';

        let isUsed = await isUsedUnisatDomain(domain);

        if (domain && isUsed === true) {

            registered.push(domain);

        } else if (domain && isUsed === null) {

            rate_limited = true;
            break;
        }

        await sleep(1000);

        i++;
    }

    $('.unisat_checker').innerHTML = 'Check availability';

    if (rate_limited) {
        alert('Cannot check any domain availability as a rate limit occurred.');
    }

    if (registered.length != 0) {
        alert('The domain(s) ' + registered.join(', ') + ' is/are already registered.');
    } else {
        alert('All domains are available.');
    }
}


async function checkDomain() {

    $('.dns_checker').innerHTML = 'Please wait...';

    let i = 1;
    let registered = [];
    let rate_limited = false;
    let sats_domains = $('.dns').value.split("\n");
    let sats_domains_cleaned = [];

    for (let sats_domain in sats_domains) {

        let domain = sats_domains[sats_domain].trim();

        if (domain == '' || sats_domains_cleaned.includes(domain)) {

            continue;
        }

        sats_domains_cleaned.push(domain);
    }

    for (let sats_domain in sats_domains_cleaned) {

        let domain = sats_domains_cleaned[sats_domain].trim();

        $('.dns_checker').innerHTML = 'Checking...(' + i + '/' + sats_domains_cleaned.length + ')';

        let isUsed = await isUsedDomain(domain);

        if (domain && isUsed === true) {

            registered.push(domain);

        } else if (domain && isUsed === null) {

            rate_limited = true;
            break;
        }

        await sleep(1000);

        i++;
    }

    $('.dns_checker').innerHTML = 'Check availability';

    if (rate_limited) {
        alert('Cannot check any domain availability as a rate limit occurred.');
    }

    if (registered.length != 0) {
        alert('The domain(s) ' + registered.join(', ') + ' is/are already registered.');
    } else {
        alert('All domains are available.');
    }
}

$('.unisat_checker').onclick = checkUnisatDomain;
$('.dns_checker').onclick = checkDomain;
$('#bytes_checker').onclick = async function () {
    $('#bytes_checker').innerHTML = 'Please wait...';

    let inscribed_already = [];
    let errors = [];

    for (let i = 0; i < files.length; i++) {
        $('#bytes_checker').innerHTML = 'Please wait...(' + (i + 1) + '/' + files.length + ')';

        let hash_result = await getData('https://api2.ordinalsbot.com/search?hash=' + files[i].sha256);

        console.log(hash_result);

        try {
            hash_result = JSON.parse(hash_result);

            if (hash_result.results.length != 0) {
                inscribed_already.push(files[i].name);
            }
        } catch (e) {
            errors.push(files[i].name);
        }
        await sleep(1000);
    }

    if (inscribed_already.length != 0) {
        alert("The following files are inscribed already: " + inscribed_already.join(', '));
    }

    if (errors.length != 0) {
        alert("Could not check the following files due to an error: " + inscribed_already.join(', '));
    }

    if (inscribed_already.length == 0) {
        alert("Your files seem not to be inscribed yet.");
    }

    $('#bytes_checker').innerHTML = 'Check if file(s) are inscribed already';
}

async function init(num) {

    if (!num) {
        let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        if (isSafari) $('.safari_warning').style.display = "block";
        let minfee = await getMinFeeRate();
        $('#sats_per_byte').innerText = minfee;
        $('#sats_range').value = minfee;
    }
    num = num + 1;
    let allrates = await getAllFeeRates();
    $('.minfee .num').innerText = allrates["minimumFee"];
    $('.midfee .num').innerText = allrates["hourFee"];
    $('.maxfee .num').innerText = allrates["fastestFee"];
    let isgreen;
    $$('.fee .num').forEach(function (item) {
        if (item.style.backgroundColor == "green" || getComputedStyle(item).backgroundColor == "rgb(0, 128, 0)") isgreen = item;
    });
    if (isgreen) {
        $('#sats_per_byte').innerText = Number(isgreen.innerText);
        $('#sats_range').value = Number(isgreen.innerText);
        sessionStorage["feerate"] = isgreen.innerText;
    }
    sessionStorage["bitcoin_price"] = await getBitcoinPrice();
    await waitSomeSeconds(10);
    init(num);
}

function encodeBase64(file) {
    return new Promise(function (resolve, reject) {
        let imgReader = new FileReader();
        imgReader.onloadend = function () {
            resolve(imgReader.result.toString());
        }
        imgReader.readAsDataURL(file);
    });
}

function base64ToHex(str) {
    const raw = atob(str);
    let result = '';
    for (let i = 0; i < raw.length; i++) {
        const hex = raw.charCodeAt(i).toString(16);
        result += (hex.length === 2 ? hex : '0' + hex);
    }
    return result.toLowerCase();
}

function buf2hex(buffer) { // buffer is an ArrayBuffer
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

function hexToBytes(hex) {
    return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
}

function bytesToHex(bytes) {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
}

function textToHex(text) {
    var encoder = new TextEncoder().encode(text);
    return [...new Uint8Array(encoder)]
        .map(x => x.toString(16).padStart(2, "0"))
        .join("");
}

function createQR(content) {
    let dataUriPngImage = document.createElement("img"),
        s = QRCode.generatePNG(content, {
            ecclevel: "M",
            format: "html",
            fillcolor: "#FFFFFF",
            textcolor: "#000000",
            margin: 4,
            modulesize: 8,
        });
    dataUriPngImage.src = s;
    dataUriPngImage.id = "qr_code";
    return dataUriPngImage;
}

async function getBitcoinPriceFromCoinbase() {
    let data = await getData("https://api.coinbase.com/v2/prices/BTC-USD/spot");
    let json = JSON.parse(data);
    let price = json["data"]["amount"];
    return price;
}

async function getBitcoinPriceFromKraken() {
    let data = await getData("https://api.kraken.com/0/public/Ticker?pair=XBTUSD");
    let json = JSON.parse(data);
    let price = json["result"]["XXBTZUSD"]["a"][0];
    return price;
}

async function getBitcoinPriceFromCoindesk() {
    let data = await getData("https://api.coindesk.com/v1/bpi/currentprice.json");
    let json = JSON.parse(data);
    let price = json["bpi"]["USD"]["rate_float"];
    return price;
}

async function getBitcoinPriceFromGemini() {
    let data = await getData("https://api.gemini.com/v2/ticker/BTCUSD");
    let json = JSON.parse(data);
    let price = json["bid"];
    return price;
}

async function getBitcoinPriceFromBybit() {
    let data = await getData("https://api-testnet.bybit.com/derivatives/v3/public/order-book/L2?category=linear&symbol=BTCUSDT");
    let json = JSON.parse(data);
    let price = json["result"]["b"][0][0];
    return price;
}

async function getBitcoinPrice() {
    let prices = [];
    let cbprice = await getBitcoinPriceFromCoinbase();
    let kprice = await getBitcoinPriceFromKraken();
    let cdprice = await getBitcoinPriceFromCoindesk();
    let gprice = await getBitcoinPriceFromGemini();
    let bprice = await getBitcoinPriceFromBybit();
    prices.push(Number(cbprice), Number(kprice), Number(cdprice), Number(gprice), Number(bprice));
    prices.sort();
    return prices[2];
}

init(0);