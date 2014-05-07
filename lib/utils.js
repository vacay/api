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

module.exports = {
    orderArray: orderArray
};
