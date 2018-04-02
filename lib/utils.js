/* global module */

var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

var orderArray = function(array_with_order, array_to_order) {
    var ordered_array = [],
	len = array_to_order.length,
	len_copy = len,
	index, current;

    for (; len--;) {
	current = array_to_order[len];
	index = array_with_order.indexOf(current.id);
	ordered_array[index] = current;
    }

    Array.prototype.splice.apply(array_to_order, [0, len_copy].concat(ordered_array));
};

var escape = function(string) {
    return string.replace(/[\+\-&|!(){}[\]^"~*?:\\/]/g, '\\$&');
};

var isEmail = function(string) {
    return re.test(string);
};

module.exports = {
    orderArray: orderArray,
    escape: escape,
    isEmail: isEmail
};
