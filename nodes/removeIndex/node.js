output = function() {
  $.db.removeIndex($.fieldName,
    function(err) {
    if(err) {
      output({error: $.create(err)});
    } else {
      output({db: $.get('db')});
    }
  });
};
