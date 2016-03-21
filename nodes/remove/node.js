output = function() {
  $.db.remove($.query, $.options,
    function(err, numRemoved, newDoc) {
    if(err) {
      output({error: $.create(err)});
    } else {
      output({out: $.create(newDoc), numRemoved: $.create(numRemoved)});
    }
  });
};
