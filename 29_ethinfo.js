'use strict';
'require baseclass';
'require fs';
'require ui';
'require uci';
'require rpc';
'require network';

var callGetBuiltinEthernetPorts = rpc.declare({
	object: 'luci',
	method: 'getBuiltinEthernetPorts',
	expect: { result: [] }
});

function formatSpeed(carrier, speed, duplex) {
	if ((speed > 0) && duplex) {
		var d = (duplex == 'half') ? '\u202f(H)' : '',
		    e = E('span', { 'title': _('Speed: %d Mibit/s, Duplex: %s').format(speed, duplex) });

		switch (speed) {
		case 10:    e.innerText = '10Mb/s' + d;  break;
		case 100:   e.innerText = '100Mb/s' + d; break;
		case 1000:  e.innerText = '1000Mb/s' + d; break;
		case 2500:  e.innerText = '2500Mb/s';   break;
		case 5000:  e.innerText = '5000Mb/s';     break;
		case 10000: e.innerText = '10Gb/s';    break;
		case 25000: e.innerText = '25Gb/s';    break;
		case 40000: e.innerText = '40Gb/s';    break;
		default:    e.innerText = '%d\u202fMb/s%s'.format(speed, d);
		}

		return e;
	}

	return carrier ? _('Connected') : _('no link');
}

function formatStats(portdev) {
    var stats = portdev._devstate('stats') || {};
    return E('span', { 'class': 'cbi-tooltip' }, [
        E('span', {}, [
            E('span', { 'class': 'nowrap' }, [
                E('strong', {}, _('Received bytes') + ': '), 
                '%1024mB'.format(stats.rx_bytes)
            ]),
            E('br'),
            E('span', { 'class': 'nowrap' }, [
                E('strong', {}, _('Received packets') + ': '), 
                '%1000mPkts.'.format(stats.rx_packets)
            ]),
            E('br'),
            E('span', { 'class': 'nowrap' }, [
                E('strong', {}, _('Received multicast') + ': '), 
                '%1000mPkts.'.format(stats.multicast)
            ]),
            E('br'),
            E('span', { 'class': 'nowrap' }, [
                E('strong', {}, _('Receive errors') + ': '), 
                '%1000mPkts.'.format(stats.rx_errors)
            ]),
            E('br'),
            E('span', { 'class': 'nowrap' }, [
                E('strong', {}, _('Receive dropped') + ': '), 
                '%1000mPkts.'.format(stats.rx_dropped)
            ]),
            E('br'),
            E('span', { 'class': 'nowrap' }, [
                E('strong', {}, _('Transmitted bytes') + ': '), 
                '%1024mB'.format(stats.tx_bytes)
            ]),
            E('br'),
            E('span', { 'class': 'nowrap' }, [
                E('strong', {}, _('Transmitted packets') + ': '), 
                '%1000mPkts.'.format(stats.tx_packets)
            ]),
            E('br'),
            E('span', { 'class': 'nowrap' }, [
                E('strong', {}, _('Transmit errors') + ': '), 
                '%1000mPkts.'.format(stats.tx_errors)
            ]),
            E('br'),
            E('span', { 'class': 'nowrap' }, [
                E('strong', {}, _('Transmit dropped') + ': '), 
                '%1000mPkts.'.format(stats.tx_dropped)
            ]),
            E('br'),
            E('span', { 'class': 'nowrap' }, [
                E('strong', {}, _('Collisions seen') + ': '), 
                stats.collisions
            ])
        ])
    ]);
}

return baseclass.extend({
	title: _('Ethernet Information'),

	load: function() {
		return Promise.all([
			L.resolveDefault(callGetBuiltinEthernetPorts(), []),
			L.resolveDefault(fs.read('/etc/board.json'), '{}'),
			network.getNetworks(),
			uci.load('network')
		]);
	},

	render: function(data) {
		if (L.hasSystemFeature('swconfig'))
			return null;

		var board = JSON.parse(data[1]),
		    known_ports = [];

		if (Array.isArray(data[0]) && data[0].length > 0) {
			known_ports = data[0].map(port => ({
				...port,
				netdev: network.instantiateDevice(port.device)
			}));
		}
		else {
			if (L.isObject(board) && L.isObject(board.network)) {
				for (var k = 'lan'; k != null; k = (k == 'lan') ? 'wan' : null) {
					if (!L.isObject(board.network[k]))
						continue;

					if (Array.isArray(board.network[k].ports))
						for (let i = 0; i < board.network[k].ports.length; i++)
							known_ports.push({
								role: k,
								device: board.network[k].ports[i],
								netdev: network.instantiateDevice(board.network[k].ports[i])
							});
					else if (typeof(board.network[k].device) == 'string')
						known_ports.push({
							role: k,
							device: board.network[k].device,
							netdev: network.instantiateDevice(board.network[k].device)
						});
				}
			}
		}

		known_ports.sort(function(a, b) {
			return L.naturalCompare(a.device, b.device);
		});

		var table = E('table', { 'class': 'table' });

		var tableHeader = E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('Ethernet Name')),
			E('th', { 'class': 'th' }, _('Link Status')),
			E('th', { 'class': 'th' }, _('Speed')),
			E('th', { 'class': 'th' }, _('Duplex'))
		]);
		table.appendChild(tableHeader);

		known_ports.forEach(function (port) {
			var speed = port.netdev.getSpeed(),
				duplex = port.netdev.getDuplex(),
				carrier = port.netdev.getCarrier(),
				statsInfo = formatStats(port.netdev);

			if (duplex === 'full') {
				duplex = _('Full Duplex');
			} else if (duplex === 'half') {
				duplex = _('Half Duplex');
			}

			var tableRow = E('tr', { 'class': 'tr cbi-tooltip-container' }, [
				E('td', { 'class': 'td' }, port.netdev.getName()),
				E('td', { 'class': 'td' }, carrier ? _('Connected') : _('no link')),
				E('td', { 'class': 'td' }, formatSpeed(carrier, speed, duplex).innerText),
				E('td', { 'class': 'td' }, duplex)
			]);

			tableRow.childNodes.forEach(function(td) {
				td.appendChild(E('span', { 'class': 'cbi-tooltip-container' }, statsInfo));
			});

			table.appendChild(tableRow);
		});

		return table;
	}
});
